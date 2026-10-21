// OrganizaRH v5: autenticação por setor e isolamento de registros no servidor.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'contas.json');
const SECTORS_DIR = path.join(DATA_DIR, 'setores');
const TIPOS = new Set(['ferias', 'abonada', 'atestado', 'outras']);
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE_NAME = 'organiz arh_session'.replace(' ', '');
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const routers = new Map();
const sessions = new Map();
const attempts = new Map();
fs.mkdirSync(DATA_DIR, {recursive: true});
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Cache-Control','no-store');
  next();
});
app.use(express.json({limit:'100kb'}));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/index.html',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
// Deliberadamente não publicamos /data, .git, server.js ou qualquer outro arquivo da pasta.
function loadArray(file) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  if (!fs.existsSync(file)) fs.writeFileSync(file,'[]\n','utf8');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`O arquivo ${path.basename(file)} deve conter uma lista.`);
  return value;
}
function persist(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data,null,2)}\n`,{encoding:'utf8',mode:0o600});
  fs.renameSync(tmp,file);
}
function isLocal(req){
  const addr=req.socket.remoteAddress;
  return addr==='127.0.0.1'||addr==='::1'||addr==='::ffff:127.0.0.1';
}
function normalizeUsername(raw){return typeof raw==='string'?raw.trim().toLowerCase():'';}
function validUsername(s){return /^[a-z0-9._-]{3,32}$/.test(s);}
// Não exigimos formato ou tamanho mínimo: qualquer senha não vazia é aceita.
// O limite técnico evita requisições excessivamente grandes.
function validPassword(p){return typeof p==='string' && p.length>=1 && p.length<=1024;}
async function hashPassword(pass){
  const salt=crypto.randomBytes(16).toString('hex');
  const hashed=await scrypt(pass,salt,64);
  return `scrypt:${salt}:${hashed.toString('hex')}`;
}
async function matchesPassword(pass,record){
  if(typeof pass!=='string'||!record||typeof record!=='string')return false;
  const parts=record.split(':');if(parts.length!==3||parts[0]!=='scrypt'||!/^[a-f0-9]{32}$/.test(parts[1])||!/^[a-f0-9]{128}$/.test(parts[2]))return false;
  const hash=await scrypt(pass,parts[1],64);
  return crypto.timingSafeEqual(hash,Buffer.from(parts[2],'hex'));
}
function loadAccounts(){
  if(!fs.existsSync(ACCOUNTS_FILE))return {version:1,admin:null,sectors:[]};
  const data=JSON.parse(fs.readFileSync(ACCOUNTS_FILE,'utf8'));
  if(!data || !Array.isArray(data.sectors))throw new Error('Arquivo de contas inválido.');
  return data;
}
let accounts=loadAccounts();
let setupInProgress=false;
function failRate(req,group){
  const key=`${group}:${req.socket.remoteAddress||'unknown'}`;
  const now=Date.now();
  let row=attempts.get(key);
  if(!row||row.until<now){row={count:0,until:now+15*60*1000};attempts.set(key,row)}
  if(row.count>=12)return true;
  row.count++;return false;
}
function clearRate(req,group){attempts.delete(`${group}:${req.socket.remoteAddress||'unknown'}`)}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(c=>{const i=c.indexOf('=');return [c.slice(0,i),c.slice(i+1)]}));}
function getSession(req){
  const token=cookies(req)[COOKIE_NAME];if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=sessions.get(token);
  if(!session)return null;
  if(session.expiry<Date.now()){sessions.delete(token);return null}
  if(session.role==='setor'&&!accounts.sectors.some(s=>s.id===session.sectorId)){sessions.delete(token);return null}
  return session;
}
function setSession(res,session,req){
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,session);
  const secure=req.secure || (process.env.ORGANIZARH_HTTPS==='1');
  res.setHeader('Set-Cookie',`${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_MS/1000)}${secure?'; Secure':''}`);
}
function clearSession(req,res){
  const token=cookies(req)[COOKIE_NAME];if(token)sessions.delete(token);
  res.setHeader('Set-Cookie',`${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}
function csrf(req,res,next){
  if(!MUTATING.has(req.method))return next();
  if(req.get('X-OrganizaRH-Request')!=='1')return res.status(403).json({error:'Requisição não autorizada.'});
  const origin=req.get('Origin');
  if(origin){try{if(new URL(origin).host!==req.get('Host'))return res.status(403).json({error:'Origem não permitida.'})}catch{return res.status(403).json({error:'Origem inválida.'})}}
  next();
}
app.use('/api',csrf);
// Setor de migração legado fica armazenado como backup, mas não aparece no sistema.
function regularSectors(){return accounts.sectors.filter(x=>x.id!=='legado')}
function displaySession(s){
  const sectors=regularSectors().map(x=>({id:x.id,nome:x.nome,active:!!(x.username&&x.hash)}));
  return {role:s.role,username:s.username,sectorId:s.sectorId,sectorName:sectors.find(x=>x.id===s.sectorId)?.nome||'',sectors:s.role==='admin'?sectors:undefined};
}
app.get('/api/auth/status',(req,res)=>res.json({configured:!!accounts.admin,canSetup:!accounts.admin&&isLocal(req)}));
// Primeiro uso: somente na própria máquina que executa o servidor.
app.post('/api/auth/setup',async(req,res,next)=>{
 try{
  if(accounts.admin||setupInProgress)return res.status(409).json({error:'O administrador já foi configurado ou está sendo configurado.'});
  if(!isLocal(req))return res.status(403).json({error:'Crie o administrador acessando localhost na máquina do servidor.'});
  const pass=req.body?.senha;
  if(!validPassword(pass))return res.status(400).json({error:'Informe uma senha para o administrador.'});
  setupInProgress=true;
  const newAccount={version:1,admin:await hashPassword(pass),sectors:[]};
  // Mantém uma cópia de segurança dos registros prévios sem criar um setor visível.
  const legacyFolder=path.join(SECTORS_DIR,'legado');
  fs.mkdirSync(legacyFolder,{recursive:true});
  for(const filename of ['pessoas.json','afastamentos.json','reunioes.json']){
    const oldPath=path.join(DATA_DIR,filename),newPath=path.join(legacyFolder,filename);
    if(!fs.existsSync(newPath)){
      if(fs.existsSync(oldPath))fs.copyFileSync(oldPath,newPath,fs.constants.COPYFILE_EXCL);
      else persist(newPath,[]);
    }
  }
  // Contas são gravadas somente depois que a cópia dos dados foi concluída.
  persist(ACCOUNTS_FILE,newAccount);accounts=newAccount;
  return res.status(201).json({message:'Administrador configurado. Faça login como admin.'});
 }catch(e){next(e)}finally{setupInProgress=false}
});
app.post('/api/auth/login',async(req,res,next)=>{
 try{
  if(!accounts.admin)return res.status(409).json({error:'Configure o administrador antes de entrar.'});
  if(failRate(req,'login'))return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});
  const name=normalizeUsername(req.body?.usuario),pass=req.body?.senha;
  const isAdmin=name==='admin';
  const setor=isAdmin?null:accounts.sectors.find(x=>x.username===name);
  const matched=await matchesPassword(pass,isAdmin?accounts.admin:setor?.hash);
  if(!matched)return res.status(401).json({error:'Usuário ou senha incorretos.'});
  clearRate(req,'login');
  const sectorId=isAdmin?(regularSectors()[0]?.id || 'admin-inicial'):setor.id;
  const session={role:isAdmin?'admin':'setor',username:name,sectorId,expiry:Date.now()+SESSION_MS};
  setSession(res,session,req);
  return res.json(displaySession(session));
 }catch(e){next(e)}
});
app.post('/api/auth/create-sector',async(req,res,next)=>{
 try{
  if(!accounts.admin)return res.status(409).json({error:'Configure primeiro o administrador.'});
  if(failRate(req,'register'))return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});
  const nome=typeof req.body?.setor==='string'?req.body.setor.trim():null,username=normalizeUsername(req.body?.usuario),senha=req.body?.senha,adminPass=req.body?.senhaAdmin;
  if(typeof nome!=='string'||nome.length<2||nome.length>70)return res.status(400).json({error:'Informe o nome do setor (2 a 70 caracteres).'});
  if(!validUsername(username)||username==='admin')return res.status(400).json({error:'Usuário deve ter 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.'});
  if(!validPassword(senha))return res.status(400).json({error:'Informe uma senha para o setor.'});
  const normalizedName=nome.toLocaleLowerCase('pt-BR');
  const existing=accounts.sectors.find(x=>x.nome.toLocaleLowerCase('pt-BR')===normalizedName);
  if(accounts.sectors.some(x=>x.username===username))return res.status(409).json({error:'Esse usuário já está cadastrado.'});
  if(existing && (existing.username || existing.id==='legado'))return res.status(409).json({error:'Já existe um setor ativo com esse nome.'});
  if(!await matchesPassword(adminPass,accounts.admin))return res.status(403).json({error:'Senha do administrador incorreta.'});
  const hash=await hashPassword(senha);
  let nextAccounts;
  if(existing){
    // Recriar um login para um setor desativado recupera os mesmos dados anteriores.
    nextAccounts={...accounts,sectors:accounts.sectors.map(x=>x.id===existing.id?{...x,username,hash,disabledAt:null}:x)};
  }else{
    const setor={id:crypto.randomUUID(),nome,username,hash};
    const sectorDir=path.join(SECTORS_DIR,setor.id);
    fs.mkdirSync(sectorDir,{recursive:true});
    for(const filename of ['pessoas.json','afastamentos.json','reunioes.json'])persist(path.join(sectorDir,filename),[]);
    nextAccounts={...accounts,sectors:[...accounts.sectors,setor]};
  }
  persist(ACCOUNTS_FILE,nextAccounts);accounts=nextAccounts;
  clearRate(req,'register');
  return res.status(201).json({message:existing?'Acesso do setor reativado com os dados anteriores.':'Setor cadastrado. Já é possível entrar com o usuário criado.'});
 }catch(e){next(e)}
});
app.get('/api/auth/me',(req,res)=>{
 const s=getSession(req);
 if(!s)return res.status(401).json({error:'Não autenticado.'});
 return res.json(displaySession(s));
});
app.post('/api/auth/logout',(req,res)=>{clearSession(req,res);res.json({message:'Sessão encerrada.'})});
app.post('/api/auth/select-sector',(req,res)=>{
 const s=getSession(req);
 if(!s)return res.status(401).json({error:'Faça login.'});
 if(s.role!=='admin')return res.status(403).json({error:'Somente o administrador pode trocar de setor.'});
 const chosen=regularSectors().find(x=>x.id===req.body?.sectorId);
 if(!chosen)return res.status(400).json({error:'Setor inválido.'});
 s.sectorId=chosen.id;
 return res.json(displaySession(s));
});
function requireAuth(req,res,next){
 const s=getSession(req);
 if(!s)return res.status(401).json({error:'Faça login para acessar os dados.'});
 req.session=s;
 next();
}
// Administração geral: todas as operações abaixo são verificadas no servidor.
function requireAdmin(req,res,next){
 const s=getSession(req);
 if(!s)return res.status(401).json({error:'Faça login para continuar.'});
 if(s.role!=='admin')return res.status(403).json({error:'Acesso exclusivo do administrador.'});
 req.session=s;next();
}
function invalidateSessions(predicate){
 for(const [token,session] of sessions){if(predicate(session))sessions.delete(token)}
}
app.get('/api/admin/users',requireAdmin,(req,res)=>res.json({
 admin:{username:'admin'},
 sectors:regularSectors().map(s=>({id:s.id,nome:s.nome,username:s.username||null,active:!!(s.username&&s.hash)}))
}));
app.put('/api/admin/password',requireAdmin,async(req,res,next)=>{
 try{
  if(failRate(req,'admin'))return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});
  const target=req.body?.target,senha=req.body?.novaSenha,senhaAdmin=req.body?.senhaAdmin;
  if(!validPassword(senha))return res.status(400).json({error:'Informe a nova senha.'});
  if(!await matchesPassword(senhaAdmin,accounts.admin))return res.status(403).json({error:'Senha atual do administrador incorreta.'});
  const isAdmin=target==='admin';
  const sector=isAdmin?null:accounts.sectors.find(s=>s.id===target&&s.username&&s.hash);
  if(!isAdmin&&!sector)return res.status(404).json({error:'Usuário de setor não encontrado ou desativado.'});
  const hash=await hashPassword(senha);
  const nextAccounts=isAdmin?{...accounts,admin:hash}:{...accounts,sectors:accounts.sectors.map(s=>s.id===target?{...s,hash}:s)};
  persist(ACCOUNTS_FILE,nextAccounts);accounts=nextAccounts;
  if(isAdmin){
    invalidateSessions(s=>s.role==='admin');
    clearSession(req,res);
  }else invalidateSessions(s=>s.role==='setor'&&s.sectorId===sector.id);
  clearRate(req,'admin');
  res.json({message:isAdmin?'Senha do administrador alterada. Entre novamente.':'Senha do setor alterada. O setor deverá entrar novamente.',mustRelogin:isAdmin});
 }catch(e){next(e)}
});
app.delete('/api/admin/users/:id',requireAdmin,async(req,res,next)=>{
 try{
  if(failRate(req,'admin'))return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});
  if(req.body?.confirmar!==true)return res.status(400).json({error:'Confirme a exclusão do usuário.'});
  if(!await matchesPassword(req.body?.senhaAdmin,accounts.admin))return res.status(403).json({error:'Senha do administrador incorreta.'});
  const sector=accounts.sectors.find(s=>s.id===req.params.id&&s.username&&s.hash);
  if(!sector)return res.status(404).json({error:'Usuário não encontrado ou já excluído.'});
  // Desativar as credenciais preserva os arquivos, reuniões e afastamentos do setor.
  const nextAccounts={...accounts,sectors:accounts.sectors.map(s=>s.id===sector.id?{...s,username:null,hash:null,disabledAt:new Date().toISOString()}:s)};
  persist(ACCOUNTS_FILE,nextAccounts);accounts=nextAccounts;
  invalidateSessions(s=>s.role==='setor'&&s.sectorId===sector.id);
  clearRate(req,'admin');
  res.json({message:'Login excluído. Os dados do setor foram preservados para o administrador.'});
 }catch(e){next(e)}
});
// Cada roteador mantém arrays e arquivos exclusivos de um setor.
function getRouter(sectorId){
 if(routers.has(sectorId))return routers.get(sectorId);
 const setor=accounts.sectors.find(x=>x.id===sectorId);
 if(!setor)throw new Error('Setor inexistente.');
 const root=path.join(SECTORS_DIR,setor.id);
 const PEOPLE_FILE=path.join(root,'pessoas.json');
 const ABSENCE_FILE=path.join(root,'afastamentos.json');
 const MEETING_FILE=path.join(root,'reunioes.json');
 let pessoas=loadArray(PEOPLE_FILE);
 let afastamentos=loadArray(ABSENCE_FILE);
 let reunioes=loadArray(MEETING_FILE);
 const router=express.Router();
function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y,m,d] = s.split('-').map(Number); const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d;
}
function validatePerson(body) {
  if (typeof body.nome !== 'string' || !body.nome.trim()) return 'Informe o nome da pessoa.';
  if (body.nome.trim().length > 150) return 'O nome deve ter no máximo 150 caracteres.';
  if (pessoas.some(p => p.nome.toLocaleLowerCase('pt-BR') === body.nome.trim().toLocaleLowerCase('pt-BR'))) return 'Essa pessoa já está cadastrada.';
  return null;
}
function validateAbsence(body) {
  if (!pessoas.some(p => String(p.id) === String(body.pessoaId))) return 'Selecione uma pessoa cadastrada.';
  if (!TIPOS.has(body.tipo)) return 'Selecione um tipo de afastamento válido.';
  if (!validDate(body.inicio)) return 'Informe uma data de início válida.';
  const dias = Number(body.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 366) return 'A quantidade de dias deve ser um número inteiro entre 1 e 366.';
  return null;
}
router.get('/pessoas', (req,res) => res.json(pessoas));
router.post('/pessoas', (req,res) => {
  const error = validatePerson(req.body || {}); if (error) return res.status(400).json({error});
  const person = {id: crypto.randomUUID(), nome: req.body.nome.trim(), criadoEm: new Date().toISOString()};
  pessoas.push(person); try { persist(PEOPLE_FILE,pessoas); } catch(e) { pessoas = pessoas.filter(p=>p.id!==person.id); console.error(e); return res.status(500).json({error:'Não foi possível salvar a pessoa.'}); }
  return res.status(201).json(person);
});
router.delete('/pessoas/:id', (req,res) => {
  if(req.body?.confirmar!==true)return res.status(400).json({error:'Confirme a exclusão da pessoa.'});
  const pessoa=pessoas.find(p=>String(p.id)===String(req.params.id));
  if(!pessoa)return res.status(404).json({error:'Pessoa não encontrada.'});
  const previousPeople=pessoas, previousAbsences=afastamentos;
  pessoas=pessoas.filter(p=>String(p.id)!==String(req.params.id));
  afastamentos=afastamentos.filter(a=>String(a.pessoaId)!==String(req.params.id));
  try{persist(ABSENCE_FILE,afastamentos);persist(PEOPLE_FILE,pessoas);return res.json({message:'Pessoa e afastamentos excluídos.'})}
  catch(e){pessoas=previousPeople;afastamentos=previousAbsences;console.error(e);try{persist(ABSENCE_FILE,afastamentos);persist(PEOPLE_FILE,pessoas)}catch(rollbackError){console.error('Erro ao restaurar arquivos:',rollbackError)}return res.status(500).json({error:'Não foi possível excluir a pessoa.'})}
});
router.get('/afastamentos', (req,res) => res.json(afastamentos));
router.post('/afastamentos', (req,res) => {
  const error = validateAbsence(req.body || {}); if (error) return res.status(400).json({error});
  const item = {id:crypto.randomUUID(), pessoaId:String(req.body.pessoaId), tipo:req.body.tipo, inicio:req.body.inicio, dias:Number(req.body.dias), reserva15:req.body.tipo==='ferias'&&req.body.reserva15===true, criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString()};
  afastamentos.push(item); try { persist(ABSENCE_FILE,afastamentos); } catch(e) { afastamentos=afastamentos.filter(a=>a.id!==item.id); console.error(e); return res.status(500).json({error:'Não foi possível salvar o afastamento.'}); }
  return res.status(201).json(item);
});
router.put('/afastamentos/:id', (req,res) => {
  const i=afastamentos.findIndex(a=>String(a.id)===String(req.params.id)); if(i<0)return res.status(404).json({error:'Afastamento não encontrado.'});
  const error=validateAbsence(req.body||{});if(error)return res.status(400).json({error});
  const old=afastamentos[i], updated={...old,pessoaId:String(req.body.pessoaId),tipo:req.body.tipo,inicio:req.body.inicio,dias:Number(req.body.dias),reserva15:req.body.tipo==='ferias'&&req.body.reserva15===true,atualizadoEm:new Date().toISOString()};afastamentos[i]=updated;
  try{persist(ABSENCE_FILE,afastamentos)}catch(e){afastamentos[i]=old;console.error(e);return res.status(500).json({error:'Não foi possível salvar as alterações.'})}return res.json(updated);
});
router.post('/afastamentos/ocultar-resumo', (req,res) => {
  const tipo = req.body?.tipo;
  if (req.body?.confirmar !== true) return res.status(400).json({error:'Confirme a operação para continuar.'});
  if (!['abonada','ferias'].includes(tipo)) return res.status(400).json({error:'Tipo de registro inválido.'});
  const previous = afastamentos.map(a => ({...a}));
  let count = 0;
  afastamentos = afastamentos.map(a => {
    if (a.tipo === tipo && !a.ocultoResumo) { count++; return {...a, ocultoResumo:true}; }
    return a;
  });
  try {
    persist(ABSENCE_FILE, afastamentos);
    return res.json({message: count ? `${count} registro(s) ocultado(s) desta aba. Os registros continuam no calendário.` : 'Não há registros novos para ocultar.', ocultados:count});
  } catch (e) {
    afastamentos = previous;
    console.error(e);
    return res.status(500).json({error:'Não foi possível limpar a listagem.'});
  }
});
router.delete('/afastamentos/:id',(req,res)=>{const i=afastamentos.findIndex(a=>String(a.id)===String(req.params.id));if(i<0)return res.status(404).json({error:'Afastamento não encontrado.'});const [old]=afastamentos.splice(i,1);try{persist(ABSENCE_FILE,afastamentos)}catch(e){afastamentos.splice(i,0,old);console.error(e);return res.status(500).json({error:'Não foi possível excluir o afastamento.'})}return res.json({message:'Afastamento excluído.'})});

// Reuniões são independentes dos afastamentos e armazenadas em arquivo separado.
function validTime(value) { return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function validateMeeting(body) {
  if (typeof body.titulo !== 'string' || !body.titulo.trim() || body.titulo.trim().length > 150) return 'Informe o título da reunião (até 150 caracteres).';
  if (!validDate(body.data)) return 'Informe uma data válida para a reunião.';
  if (!validTime(body.horaInicio) || !validTime(body.horaFim) || body.horaFim <= body.horaInicio) return 'Informe horários válidos, com término posterior ao início.';
  for (const [key, max] of [['local', 160], ['participantes', 500], ['observacoes', 1500]]) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > max)) return `O campo ${key} excede o limite permitido.`;
  }
  return null;
}
function meetingPayload(body) {
  return {titulo:body.titulo.trim(), data:body.data, horaInicio:body.horaInicio, horaFim:body.horaFim,
    local:(body.local||'').trim(), participantes:(body.participantes||'').trim(), observacoes:(body.observacoes||'').trim()};
}
router.get('/reunioes', (req,res) => res.json(reunioes));
router.post('/reunioes', (req,res) => {
  const error = validateMeeting(req.body||{}); if (error) return res.status(400).json({error});
  const item = {id:crypto.randomUUID(), ...meetingPayload(req.body), criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString()};
  reunioes.push(item);
  try {persist(MEETING_FILE,reunioes)}catch(e){reunioes=reunioes.filter(m=>m.id!==item.id);console.error(e);return res.status(500).json({error:'Não foi possível salvar a reunião.'})}
  return res.status(201).json(item);
});
router.post('/reunioes/ocultar-resumo',(req,res)=>{
  if(req.body?.confirmar!==true)return res.status(400).json({error:'Confirme a operação.'});
  const previous=reunioes;let count=0;
  reunioes=reunioes.map(m=>{if(!m.ocultoResumo){count++;return {...m,ocultoResumo:true}}return m});
  try{persist(MEETING_FILE,reunioes);return res.json({message:count?`${count} reunião(ões) ocultada(s) da aba. Permanecem no calendário.`:'Nenhuma reunião nova para ocultar.',ocultados:count})}
  catch(e){reunioes=previous;console.error(e);return res.status(500).json({error:'Não foi possível limpar a aba Reuniões.'})}
});
router.put('/reunioes/:id', (req,res) => {
  const index = reunioes.findIndex(m=>String(m.id)===String(req.params.id)); if(index<0)return res.status(404).json({error:'Reunião não encontrada.'});
  const error=validateMeeting(req.body||{});if(error)return res.status(400).json({error});
  const previous=reunioes[index];const updated={...previous,...meetingPayload(req.body),atualizadoEm:new Date().toISOString()};reunioes[index]=updated;
  try{persist(MEETING_FILE,reunioes)}catch(e){reunioes[index]=previous;console.error(e);return res.status(500).json({error:'Não foi possível atualizar a reunião.'})}
  return res.json(updated);
});
router.delete('/reunioes/:id',(req,res)=>{
  const index=reunioes.findIndex(m=>String(m.id)===String(req.params.id));if(index<0)return res.status(404).json({error:'Reunião não encontrada.'});
  const [previous]=reunioes.splice(index,1);
  try{persist(MEETING_FILE,reunioes)}catch(e){reunioes.splice(index,0,previous);console.error(e);return res.status(500).json({error:'Não foi possível excluir a reunião.'})}
  return res.json({message:'Reunião excluída.'});
});


 routers.set(sectorId,router);
 return router;
}
app.use('/api',requireAuth,(req,res,next)=>{
 // Sem setores, o admin vê o calendário vazio, sem gravar em um setor oculto.
 if(req.session.role==='admin' && req.session.sectorId==='admin-inicial'){
  if(req.method==='GET' && ['/pessoas','/afastamentos','/reunioes'].includes(req.path))return res.json([]);
  return res.status(409).json({error:'Crie um login de setor antes de cadastrar registros.'});
 }
 try{return getRouter(req.session.sectorId)(req,res,next)}catch(e){next(e)}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Rota não encontrada.'}));
app.use((error,req,res,next)=>{
 if(error instanceof SyntaxError&&'body'in error)return res.status(400).json({error:'JSON inválido.'});
 console.error(error);
 return res.status(500).json({error:'Erro interno do servidor.'});
});
app.listen(PORT,()=>console.log(`OrganizaRH disponível em http://localhost:${PORT}`));
