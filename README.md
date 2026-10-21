# OrganizaRH v6.1 — Sem a seção Dados anteriores

Esta atualização remove a seção **Dados anteriores** da lista de setores e do gerenciamento de usuários. O administrador continua acessando os setores cadastrados, alterando senhas e excluindo logins.

## O que muda

- **Dados anteriores** deixa de aparecer como opção no seletor do administrador e na lista de usuários.
- Na tela de primeiro acesso, não existe mais a informação sobre o setor **Dados anteriores**.
- O administrador abre automaticamente o primeiro setor cadastrado. Se nenhum existir, a lista indica que ainda não existem setores.
- A configuração de contas e as senhas já existentes são preservadas.
- Os arquivos antigos de `data` e `data/setores/legado` **não são apagados**. Continuam guardados para eventual recuperação e não aparecem no calendário dos setores criados.

## Atualização

1. Pare o servidor (`Ctrl+C` no CMD) e **faça backup da pasta `data`**.
2. Extraia o ZIP e substitua `index.html`, `server.js`, `package.json` e `.gitignore` na pasta do sistema.
3. **Não remova nem substitua a pasta `data`**.
4. Execute `npm install` (se necessário) e `npm start`.
5. Acesse `http://localhost:3001` e entre com suas credenciais atuais.

**Observação:** esta atualização apenas remove a seção histórica da interface e do acesso administrativo, sem excluir os registros antigos do disco. Para apagar definitivamente esses arquivos é necessária uma decisão separada e backup prévio.
