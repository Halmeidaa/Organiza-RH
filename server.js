const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const PEOPLE_FILE = path.join(DATA_DIR, 'pessoas.json');
const ABSENCE_FILE = path.join(DATA_DIR, 'afastamentos.json');
const MEETING_FILE = path.join(DATA_DIR, 'reunioes.json');
const TIPOS = new Set(['ferias', 'abonada', 'atestado', 'outras']);
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(__dirname));

function loadArray(file) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]\n', 'utf8');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`O arquivo ${path.basename(file)} deve conter uma lista.`);
  return value;
}
function persist(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}
let pessoas = loadArray(PEOPLE_FILE);
let afastamentos = loadArray(ABSENCE_FILE);
let reunioes = loadArray(MEETING_FILE);
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
app.get('/api/pessoas', (req,res) => res.json(pessoas));
app.post('/api/pessoas', (req,res) => {
  const error = validatePerson(req.body || {}); if (error) return res.status(400).json({error});
  const person = {id: crypto.randomUUID(), nome: req.body.nome.trim(), criadoEm: new Date().toISOString()};
  pessoas.push(person); try { persist(PEOPLE_FILE,pessoas); } catch(e) { pessoas = pessoas.filter(p=>p.id!==person.id); console.error(e); return res.status(500).json({error:'Não foi possível salvar a pessoa.'}); }
  return res.status(201).json(person);
});
app.delete('/api/pessoas/:id', (req,res) => {
  if(req.body?.confirmar!==true)return res.status(400).json({error:'Confirme a exclusão da pessoa.'});
  const pessoa=pessoas.find(p=>String(p.id)===String(req.params.id));
  if(!pessoa)return res.status(404).json({error:'Pessoa não encontrada.'});
  const previousPeople=pessoas, previousAbsences=afastamentos;
  pessoas=pessoas.filter(p=>String(p.id)!==String(req.params.id));
  afastamentos=afastamentos.filter(a=>String(a.pessoaId)!==String(req.params.id));
  try{persist(ABSENCE_FILE,afastamentos);persist(PEOPLE_FILE,pessoas);return res.json({message:'Pessoa e afastamentos excluídos.'})}
  catch(e){pessoas=previousPeople;afastamentos=previousAbsences;console.error(e);try{persist(ABSENCE_FILE,afastamentos);persist(PEOPLE_FILE,pessoas)}catch(rollbackError){console.error('Erro ao restaurar arquivos:',rollbackError)}return res.status(500).json({error:'Não foi possível excluir a pessoa.'})}
});
app.get('/api/afastamentos', (req,res) => res.json(afastamentos));
app.post('/api/afastamentos', (req,res) => {
  const error = validateAbsence(req.body || {}); if (error) return res.status(400).json({error});
  const item = {id:crypto.randomUUID(), pessoaId:String(req.body.pessoaId), tipo:req.body.tipo, inicio:req.body.inicio, dias:Number(req.body.dias), reserva15:req.body.tipo==='ferias'&&req.body.reserva15===true, criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString()};
  afastamentos.push(item); try { persist(ABSENCE_FILE,afastamentos); } catch(e) { afastamentos=afastamentos.filter(a=>a.id!==item.id); console.error(e); return res.status(500).json({error:'Não foi possível salvar o afastamento.'}); }
  return res.status(201).json(item);
});
app.put('/api/afastamentos/:id', (req,res) => {
  const i=afastamentos.findIndex(a=>String(a.id)===String(req.params.id)); if(i<0)return res.status(404).json({error:'Afastamento não encontrado.'});
  const error=validateAbsence(req.body||{});if(error)return res.status(400).json({error});
  const old=afastamentos[i], updated={...old,pessoaId:String(req.body.pessoaId),tipo:req.body.tipo,inicio:req.body.inicio,dias:Number(req.body.dias),reserva15:req.body.tipo==='ferias'&&req.body.reserva15===true,atualizadoEm:new Date().toISOString()};afastamentos[i]=updated;
  try{persist(ABSENCE_FILE,afastamentos)}catch(e){afastamentos[i]=old;console.error(e);return res.status(500).json({error:'Não foi possível salvar as alterações.'})}return res.json(updated);
});
app.post('/api/afastamentos/ocultar-resumo', (req,res) => {
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
app.delete('/api/afastamentos/:id',(req,res)=>{const i=afastamentos.findIndex(a=>String(a.id)===String(req.params.id));if(i<0)return res.status(404).json({error:'Afastamento não encontrado.'});const [old]=afastamentos.splice(i,1);try{persist(ABSENCE_FILE,afastamentos)}catch(e){afastamentos.splice(i,0,old);console.error(e);return res.status(500).json({error:'Não foi possível excluir o afastamento.'})}return res.json({message:'Afastamento excluído.'})});

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
app.get('/api/reunioes', (req,res) => res.json(reunioes));
app.post('/api/reunioes', (req,res) => {
  const error = validateMeeting(req.body||{}); if (error) return res.status(400).json({error});
  const item = {id:crypto.randomUUID(), ...meetingPayload(req.body), criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString()};
  reunioes.push(item);
  try {persist(MEETING_FILE,reunioes)}catch(e){reunioes=reunioes.filter(m=>m.id!==item.id);console.error(e);return res.status(500).json({error:'Não foi possível salvar a reunião.'})}
  return res.status(201).json(item);
});
app.post('/api/reunioes/ocultar-resumo',(req,res)=>{
  if(req.body?.confirmar!==true)return res.status(400).json({error:'Confirme a operação.'});
  const previous=reunioes;let count=0;
  reunioes=reunioes.map(m=>{if(!m.ocultoResumo){count++;return {...m,ocultoResumo:true}}return m});
  try{persist(MEETING_FILE,reunioes);return res.json({message:count?`${count} reunião(ões) ocultada(s) da aba. Permanecem no calendário.`:'Nenhuma reunião nova para ocultar.',ocultados:count})}
  catch(e){reunioes=previous;console.error(e);return res.status(500).json({error:'Não foi possível limpar a aba Reuniões.'})}
});
app.put('/api/reunioes/:id', (req,res) => {
  const index = reunioes.findIndex(m=>String(m.id)===String(req.params.id)); if(index<0)return res.status(404).json({error:'Reunião não encontrada.'});
  const error=validateMeeting(req.body||{});if(error)return res.status(400).json({error});
  const previous=reunioes[index];const updated={...previous,...meetingPayload(req.body),atualizadoEm:new Date().toISOString()};reunioes[index]=updated;
  try{persist(MEETING_FILE,reunioes)}catch(e){reunioes[index]=previous;console.error(e);return res.status(500).json({error:'Não foi possível atualizar a reunião.'})}
  return res.json(updated);
});
app.delete('/api/reunioes/:id',(req,res)=>{
  const index=reunioes.findIndex(m=>String(m.id)===String(req.params.id));if(index<0)return res.status(404).json({error:'Reunião não encontrada.'});
  const [previous]=reunioes.splice(index,1);
  try{persist(MEETING_FILE,reunioes)}catch(e){reunioes.splice(index,0,previous);console.error(e);return res.status(500).json({error:'Não foi possível excluir a reunião.'})}
  return res.json({message:'Reunião excluída.'});
});

app.use((error,req,res,next)=>{if(error instanceof SyntaxError&&'body'in error)return res.status(400).json({error:'JSON inválido.'});console.error(error);return res.status(500).json({error:'Erro interno do servidor.'})});
app.listen(PORT,()=>console.log(`OrganizaRH disponível em http://localhost:${PORT}`));
