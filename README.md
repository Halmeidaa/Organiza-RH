#O que precisa para rodar?

- Node.js instalado no computador que servirá como servidor (inclui o npm). Você pode baixá-lo em https://nodejs.org/.
- Os arquivos do projeto, incluindo index.html, server.js e package.json.
- Um navegador, como Chrome, Edge ou Firefox.
O Git é útil para baixar e atualizar o projeto, mas não é necessário para executar o sistema se você já tem os arquivos.
Como instalar e iniciar (Windows)
1. Baixe ou extraia o projeto. Coloque os arquivos em uma pasta, por exemplo C:\OrganizaRH.

2. Abra o CMD nessa pasta. Pelo Explorador de Arquivos, abra a pasta, clique na barra de endereço, digite cmd e pressione Enter. Se preferir, use:
cd /d C:\OrganizaRH
3. Instale as dependências. Na primeira execução, digite:
npm install
Esse comando lê o package.json e instala automaticamente o que o projeto precisa, incluindo o Express. A pasta node_modules será criada; não é necessário baixá-la do GitHub.

4. Inicie o servidor:
npm start
5. Abra o sistema: acesse http://localhost:3001 no navegador do computador que está executando o servidor.

Na primeira utilização, acesse o sistema no próprio computador do servidor e configure a senha do administrador. Depois, entre com o usuário admin. Os logins dos setores podem ser criados na tela inicial mediante a senha do administrador.
Dica: mantenha a janela do CMD aberta enquanto usa o sistema. Para encerrar o servidor, pressione Ctrl + C nessa janela.

Nas próximas vezes
Não precisa executar npm install toda vez. Basta abrir o CMD na pasta do OrganizaRH e usar:
npm start
Se aparecer uma mensagem informando que node ou npm não foi reconhecido, confira a instalação do Node.js e abra um novo CMD. Se a porta 3001 já estiver ocupada, feche a instância anterior do sistema ou configure outra porta.
Acessar de outro computador na mesma rede
Com o servidor ligado e a rede configurada para permitir a conexão, outros computadores podem acessar pelo IP da máquina que executa o Node.js:
http://IP-DO-SERVIDOR:3001
localhost funciona apenas no próprio computador do servidor. Dependendo da rede, poderá ser necessário permitir a porta 3001 no firewall.
Onde ficam os dados?
Os dados são salvos pelo servidor em arquivos JSON na pasta data. Os registros dos setores ficam separados, evitando que um setor consulte os dados de outro com seu login. Essa pasta é criada conforme a configuração e o uso do sistema.

#Pra que serve

O projeto nasceu para facilitar uma tarefa que costuma dar trabalho no dia a dia: organizar férias, faltas abonadas, atestados, outros afastamentos e reuniões sem depender de várias planilhas ou anotações espalhadas.

A ideia é simples: reunir tudo em um calendário fácil de consultar. Assim, fica mais rápido descobrir quem estará ausente em determinada data, conferir os registros do mês e acompanhar os compromissos da equipe.
