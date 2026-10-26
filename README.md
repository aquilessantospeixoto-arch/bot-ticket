# Bot de Tickets para Loja (Discord)

Bot de loja com painel selecionável, categorias **Problemas**, **Ajuda** e **Resets**, tickets visíveis apenas para cliente, equipe autorizada e administradores, logs, assumir atendimento, fechar, avaliações privadas por DM (1–5 estrelas) e canal público ou privado para resultados de avaliação.

## Requisitos
- Node.js 20 ou superior
- Um bot criado em https://discord.com/developers/applications, convidado com scopes `bot` e `applications.commands`
- Permissões do bot: **Gerenciar canais**, **Ver canais**, **Enviar mensagens**, **Ler histórico de mensagens**, **Incorporar links** e **Gerenciar cargos** (para sobrescritas de canal, se necessário); deixe o cargo do bot acima do cargo da equipe, se aplicável.

## Configuração
1. Rode `npm install` na pasta.
2. Copie `.env.example` para `.env` e preencha os IDs e o token. NUNCA compartilhe seu token.
3. Crie a categoria de tickets e dois canais de texto: logs e avaliações. Proteja o canal de logs nas permissões do Discord.
4. Em `config.json`, modifique o nome da loja, a cor e as três categorias (opcional).
5. Rode `npm start` ou `iniciar.bat` (Windows).
6. No canal em que quer o painel, um administrador usa `/painel`.

## Funcionalidades
- Menu seletor para criar ticket privado, separado por categoria.
- Impede ticket duplicado aberto **na mesma categoria**.
- Botão **Assumir ticket** exclusivo da equipe (ou administradores).
- Botão **Fechar ticket** para equipe ou dono do ticket.
- Após o fechamento, ticket fica oculto ao cliente; permanece acessível à equipe, para histórico.
- Nota de **1 a 5 estrelas** por DM do bot ao dono do ticket; resultado enviado ao canal de avaliações e registrado em logs.
- `/ticket-add usuario:` e `/ticket-remover usuario:` permitem à equipe adicionar/remover outros participantes.
- Dados persistidos em `data.json`, criado automaticamente.

## Cuidados
- Administradores do Discord sempre podem acessar canais, mesmo privados. Revise permissões de todos os cargos com `Administrator`.
- A equipe deve ter acesso à categoria configurada por seu cargo (o bot define permissões por ticket).
- Se mensagens privadas do usuário estiverem bloqueadas, a avaliação não será entregue.
- Logs e registros persistem no servidor e no `data.json`: trate com cuidado e faça backup.
- Esta versão não gera transcrições HTML nem apaga tickets automaticamente.
