# OrganizaRH — Calendário de férias, afastamentos e reuniões

Aplicação local para registrar férias, faltas abonadas, atestados, outras licenças e reuniões em um calendário mensal.

## Instalação

Requer **Node.js LTS**.

```cmd
npm install
npm start
```

Abra **http://localhost:3001** no navegador. Não abra `index.html` diretamente: os dados dependem do servidor.

## Funcionalidades

- **Painel lateral do calendário:** resumo mensal de férias, abonadas, atestados e reuniões, cinco eventos a partir de hoje (ou do mês escolhido) com abertura do balão para editar/excluir, e alertas de reservas de férias pendentes. Tudo se atualiza ao trocar de mês ou cadastrar, editar e excluir registros.


- **Calendário:** exibe afastamentos (FE, FA, AT, OL) e reuniões (identificadas por **Reunião** em vermelho suave). Clique em um registro para abrir um balão com suas informações e os botões **Editar** e **Excluir**. Quando houver muitos eventos no mesmo dia, clique em **+ outros** para visualizá-los.
- **Afastamentos:** cadastro e edição por janela/balão, com pessoa, tipo, data inicial, quantidade de dias e reserva de 15 dias (férias).
- **Reuniões:** a aba também dispõe de **Limpar dados da aba**, que oculta reuniões da lista sem removê-las do calendário. Clique em **Nova reunião** ou na aba **Reuniões** para informar assunto, data, horário de início e fim, local, participantes e observações. Também é possível editar e excluir as reuniões pelo calendário e pela lista.
- **Abonadas e Férias:** mostram resumos por pessoa. O botão **Limpar dados da aba** apenas oculta os registros desses resumos; os afastamentos permanecem no calendário.
- **Reservas de férias:** cada nova reserva de 15 dias reativa o alerta vermelho, que permanece até outro período de 15 dias quitar a pendência. O ciclo pode se repetir.
- **Pessoas:** adicionar ou excluir com confirmação. A exclusão da pessoa também remove os afastamentos dela.
- **Modo escuro:** preferência armazenada no navegador.

## Armazenamento e segurança

O servidor cria automaticamente a pasta `data` e os arquivos JSON quando necessário:

- `data/pessoas.json`: funcionários cadastrados;
- `data/afastamentos.json`: férias e afastamentos;
- `data/reunioes.json`: reuniões agendadas.

**Não envie a pasta `data` ao GitHub.** Ela pode conter dados pessoais. Faça backups regulares dessa pasta. A pasta `node_modules` também não deve ser versionada; use `npm install` para recriá-la. O `.gitignore` já protege essas pastas.

**Ao atualizar a versão**, substitua `index.html`, `server.js` e demais arquivos de código, mas **não substitua nem apague sua pasta `data` existente**. Reinicie o servidor após substituir os arquivos.

> Para hospedar na internet, adicione autenticação, HTTPS e controles de acesso, além de armazenamento persistente. O servidor atual foi projetado para uso em ambiente confiável.

## Atualizar no GitHub pelo CMD

Dentro da pasta do repositório `OrganizaRH-v2`, depois de substituir os arquivos:

```cmd
git add .
git commit -m "Padronizar botoes e formularios em janelas"
git push
```
