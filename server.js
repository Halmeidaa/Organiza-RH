const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PEOPLE_FILE = path.join(DATA_DIR, 'pessoas.json');
const ABSENCE_FILE = path.join(DATA_DIR, 'afastamentos.json');
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
app.use((error,req,res,next)=>{if(error instanceof SyntaxError&&'body'in error)return res.status(400).json({error:'JSON inválido.'});console.error(error);return res.status(500).json({error:'Erro interno do servidor.'})});
app.listen(PORT,()=>console.log(`OrganizaRH disponível em http://localhost:${PORT}`));
