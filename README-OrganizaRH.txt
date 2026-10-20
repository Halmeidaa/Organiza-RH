OrganizaRH — calendário de férias e afastamentos

1. Instale o Node.js (versão LTS).
2. Coloque index.html, server.js e package.json na mesma pasta.
3. Abra o terminal nessa pasta e execute: npm install
4. Inicie o servidor: npm start
5. Acesse http://localhost:3000

Pessoas são salvas em data/pessoas.json e afastamentos em data/afastamentos.json. Faça cópias de segurança da pasta data.

O calendário considera a data de início e a quantidade de dias corridos (inclui fins de semana). Tipos: Férias (FE), Falta abonada (FA), Atestado (AT) e Outras licenças (OL).

A tela Abonadas totaliza os dias de faltas abonadas por pessoa; a tela Férias mostra quantos períodos de férias cada pessoa tirou e sinaliza em vermelho os 15 dias reservados. A reserva é encerrada quando houver outro período de férias de 15 dias com início posterior ao período que gerou a reserva. No calendário, use o seletor de mês para ir diretamente a qualquer mês e ano. O modo escuro é uma preferência guardada no navegador.

Não exponha este servidor diretamente à internet sem adicionar autenticação, HTTPS e controles de acesso.


Nas abas Abonadas e Férias, o botão “Limpar registros da aba” oculta da listagem os registros já exibidos e zera a contagem visual. É necessário confirmar em “Sim”. Os registros não são apagados e continuam no calendário; o alerta de 15 dias reservados continua visível na aba Férias.

Atualização: reservas de 15 dias podem ser feitas repetidamente; cada período posterior de 15 dias quita uma reserva anterior. O mesmo período pode quitar a reserva anterior e abrir outra se a opção Reservar 15 dias estiver marcada.
Botão Excluir pessoa: exige seleção e confirmação; exclui definitivamente a pessoa e todos os afastamentos dela. Faça backup da pasta data antes de excluir.
