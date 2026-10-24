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

#Pra que serve?

O OrganizaRH é um projeto que desenvolvi pensando inicialmente nas necessidades da Prefeitura de São Roque, onde trabalho como servidor público.

A ideia surgiu da minha própria necessidade de organizar melhor os afastamentos e compromissos do setor em que atuo. Como a Prefeitura possui um sistema de faltas abonadas, no qual cada servidor pode utilizar até seis faltas por ano, além dos períodos de férias e outros afastamentos, percebi que seria interessante reunir todas essas informações em um único lugar.

O que começou como uma ferramenta para facilitar minha própria organização acabou sendo desenvolvido para atender também ao RH do meu setor e de outros departamentos, permitindo que cada um tenha seu próprio controle de funcionários e registros.

O objetivo é simples: facilitar a rotina de trabalho, evitar o uso de várias planilhas e tornar mais prática a consulta de férias, faltas abonadas, atestados, outros afastamentos e reuniões.

#Como funciona?

O OrganizaRH é uma aplicação web que pode ser acessada pelo navegador. O sistema utiliza um servidor em Node.js, responsável por gerenciar e armazenar as informações.

No primeiro acesso, é necessário configurar uma conta de administrador. Com ela é possível criar usuários para diferentes setores, cada um com seus próprios funcionários, afastamentos e reuniões. Assim, cada departamento consegue organizar suas informações separadamente, enquanto o administrador geral pode gerenciar os diferentes setores.

Após entrar no sistema, o usuário pode cadastrar os funcionários e registrar seus afastamentos, informando o tipo, a data de início e a quantidade de dias. Todos os registros aparecem automaticamente em um calendário, identificados por cores e siglas para facilitar a visualização.

O calendário permite navegar entre os meses, consultar os afastamentos e reuniões de cada dia e visualizar um resumo dos registros do mês. Também é possível selecionar um registro para consultar suas informações, editá-lo ou excluí-lo.

#Controle de férias e faltas abonadas

Uma das principais funcionalidades do OrganizaRH é o acompanhamento das férias e faltas abonadas dos funcionários.

Na aba de Abonadas, é possível consultar os dias utilizados por cada servidor durante o ano, considerando o limite de seis faltas abonadas anuais adotado pela Prefeitura de São Roque.

Já na aba de Férias, o sistema permite acompanhar os períodos registrados e controlar os dias reservados para outra ocasião. Quando existe uma reserva pendente, um aviso é exibido até que o período correspondente seja registrado.

Essas funcionalidades foram pensadas principalmente para facilitar o controle de informações que fazem parte da rotina administrativa dos setores da Prefeitura.

#Organização de reuniões

Além dos afastamentos, o sistema também possui uma área para agendamento de reuniões.

Nela, é possível informar o assunto, a data, os horários de início e término, o local, os participantes e eventuais observações. As reuniões também aparecem no calendário, junto aos demais registros.

O OrganizaRH oferece ainda a possibilidade de configurar avisos automáticos por e-mail com as reuniões agendadas para o dia, desde que o servidor esteja configurado para realizar os envios.

#Outras funcionalidades

O sistema também conta com a opção de modo escuro, exportação de registros de férias, abonadas e reuniões para planilhas Excel, além de permitir a edição e exclusão das informações cadastradas.

Os dados são armazenados pelo servidor em arquivos JSON, permanecendo salvos mesmo após o encerramento da aplicação. O sistema também pode ser acessado por outros computadores conectados à mesma rede, desde que o servidor esteja em funcionamento e permita essas conexões.

## Demonstração do sistema

Abaixo estão algumas imagens e um vídeo mostrando
o funcionamento do OrganizaRH, desde o primeiro
acesso até a criação de usuários para os setores.

### Primeiro acesso

Nesta tela, é realizada a configuração inicial
de acesso ao sistema.

![Primeiro Login](prints/Primeiro%20Login.png)

### Criação de login por setor

O OrganizaRH permite criar usuários para
diferentes setores, mantendo os dados e
registros separados.

![Criar login do setor](prints/criar%20login%20do%20setor.png)

### Vídeo demonstrativo

Gravei uma demonstração prática do OrganizaRH,
apresentando sua interface e algumas das
funcionalidades disponíveis.

[▶ Assistir ao vídeo demonstrativo do OrganizaRH](videos/teste.mp4)
