require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('./config.json');
const required = ['DISCORD_TOKEN','CLIENT_ID','GUILD_ID','STAFF_ROLE_ID','LOG_CHANNEL_ID','REVIEW_CHANNEL_ID','TICKET_CATEGORY_ID'];
for (const key of required) if (!process.env[key]) { console.error(`Configure ${key} no arquivo .env`); process.exit(1); }
const dbPath = path.join(__dirname, 'data.json');
let db = {tickets:{}, reviews:{}, next:1};
try { db = { ...db, ...JSON.parse(fs.readFileSync(dbPath, 'utf8')) }; } catch(e) { if (e.code !== 'ENOENT') throw e; }
function save() { const temp = dbPath+'.tmp'; fs.writeFileSync(temp, JSON.stringify(db,null,2)); fs.renameSync(temp,dbPath); }
const client = new Client({intents:[GatewayIntentBits.Guilds]});
const embed = (title,description) => new EmbedBuilder().setColor(config.color).setTitle(title).setDescription(description).setTimestamp();
function staff(i) {return i.memberPermissions?.has(PermissionFlagsBits.Administrator) || (Array.isArray(i.member?.roles) ? i.member.roles.includes(process.env.STAFF_ROLE_ID) : i.member?.roles?.cache?.has(process.env.STAFF_ROLE_ID));}
function controls(closed=false) {return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_claim').setLabel('Assumir ticket').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(closed),new ButtonBuilder().setCustomId('ticket_close').setLabel('Fechar ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(closed))];}
async function log(guild, title, msg) {try {const ch=await guild.channels.fetch(process.env.LOG_CHANNEL_ID); if(ch?.isTextBased()) await ch.send({embeds:[embed(title,msg)]});} catch(err){console.error('Log:',err.message);}}
const commands=[new SlashCommandBuilder().setName('painel').setDescription('Publica o painel de tickets da loja').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),new SlashCommandBuilder().setName('ticket-add').setDescription('Adicionar um usuário ao ticket').addUserOption(x=>x.setName('usuario').setDescription('Usuário').setRequired(true)),new SlashCommandBuilder().setName('ticket-remover').setDescription('Remover um usuário do ticket').addUserOption(x=>x.setName('usuario').setDescription('Usuário').setRequired(true))];
client.once('ready',async()=>{ console.log(`Conectado como ${client.user.tag}`); try {await new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:commands.map(x=>x.toJSON())}); console.log('Comandos registrados.');} catch(e){console.error('Erro ao registrar comandos:',e);} });
client.on('interactionCreate',async i=>{
  if(!i.inGuild() && !(i.isButton() && i.customId.startsWith('review_'))) return;
  if(i.inGuild() && i.guildId!==process.env.GUILD_ID) return;
  try {
    if(i.isChatInputCommand()) {
      if(i.commandName==='painel') {
        if(!i.memberPermissions.has(PermissionFlagsBits.Administrator)) return i.reply({content:'Somente administradores podem publicar o painel.',flags:MessageFlags.Ephemeral});
        const select=new StringSelectMenuBuilder().setCustomId('ticket_open').setPlaceholder('Selecione o tipo de atendimento').addOptions(config.categories.map(c=>({label:c.label,value:c.id,description:c.description,emoji:c.emoji})));
        await i.channel.send({embeds:[embed(`🎫 Central de Atendimento — ${config.storeName}`,'Selecione abaixo o assunto do atendimento. Apenas você e a equipe autorizada terão acesso ao ticket.')],components:[new ActionRowBuilder().addComponents(select)]});
        return i.reply({content:'Painel enviado neste canal.',flags:MessageFlags.Ephemeral});
      }
      if(!staff(i)) return i.reply({content:'Apenas a equipe pode usar este comando.',flags:MessageFlags.Ephemeral});
      const ticket=db.tickets[i.channelId];
      if(!ticket || ticket.status!=='open') return i.reply({content:'Use este comando em um ticket aberto.',flags:MessageFlags.Ephemeral});
      const user=i.options.getUser('usuario');
      if(i.commandName==='ticket-add') {await i.channel.permissionOverwrites.edit(user.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}); await i.reply(`✅ ${user} adicionado ao ticket.`); await log(i.guild,'Participante adicionado',`Ticket #${ticket.id} • ${user} adicionado por ${i.user}.`);}
      if(i.commandName==='ticket-remover') {if(user.id===ticket.owner) return i.reply({content:'Não é permitido remover o dono do ticket.',flags:MessageFlags.Ephemeral});await i.channel.permissionOverwrites.delete(user.id);await i.reply(`✅ ${user} removido do ticket.`);await log(i.guild,'Participante removido',`Ticket #${ticket.id} • ${user} removido por ${i.user}.`);}
      return;
    }
    if(i.isStringSelectMenu() && i.customId==='ticket_open') {
      const cat=config.categories.find(c=>c.id===i.values[0]);if(!cat) return i.reply({content:'Categoria inválida.',flags:MessageFlags.Ephemeral});
      const existing=Object.entries(db.tickets).find(([id,t])=>t.owner===i.user.id&&t.status==='open'&&t.category===cat.id&&i.guild.channels.cache.has(id));
      if(existing) return i.reply({content:`Você já possui um ticket desta categoria: <#${existing[0]}>`,flags:MessageFlags.Ephemeral});
      await i.deferReply({flags:MessageFlags.Ephemeral});
      const id=db.next;const ch=await i.guild.channels.create({name:`ticket-${cat.id}-${id}`,type:ChannelType.GuildText,parent:process.env.TICKET_CATEGORY_ID,topic:`Ticket #${id} • Aberto por ${i.user.id} • ${cat.label}`,permissionOverwrites:[{id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:process.env.STAFF_ROLE_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}]});
      db.next++;db.tickets[ch.id]={id,owner:i.user.id,category:cat.id,status:'open',claimer:null,createdAt:new Date().toISOString()};save();
      await ch.send({content:`<@${i.user.id}> <@&${process.env.STAFF_ROLE_ID}>`,allowedMentions:{users:[i.user.id],roles:[process.env.STAFF_ROLE_ID]},embeds:[embed(`${cat.emoji} Ticket #${id} • ${cat.label}`,`Olá, <@${i.user.id}>! Descreva seu problema com detalhes. Nossa equipe atenderá aqui.\n\n**Status:** Aguardando atendimento\n**Privacidade:** Acesso restrito ao cliente e à equipe.`)],components:controls()});
      await i.editReply(`Ticket criado: ${ch}`);await log(i.guild,'🎫 Ticket aberto',`#${id} • ${cat.label}\nCliente: ${i.user}\nCanal: ${ch}`);return;
    }
    if(i.isButton() && i.customId==='ticket_claim') {
      const t=db.tickets[i.channelId];if(!t||t.status!=='open') return i.reply({content:'Ticket não está aberto.',flags:MessageFlags.Ephemeral});
      if(!staff(i)) return i.reply({content:'Somente a equipe autorizada pode assumir tickets.',flags:MessageFlags.Ephemeral});
      if(t.claimer && t.claimer!==i.user.id) return i.reply({content:`Este ticket já foi assumido por <@${t.claimer}>.`,flags:MessageFlags.Ephemeral});
      if(t.claimer===i.user.id) return i.reply({content:'Você já assumiu este ticket.',flags:MessageFlags.Ephemeral});
      t.claimer=i.user.id;save();await i.reply({embeds:[embed('🙋 Atendimento assumido',`${i.user} agora é responsável por este ticket.`)]});await log(i.guild,'Atendimento assumido',`Ticket #${t.id} • Responsável: ${i.user}.`);return;
    }
    if(i.isButton() && i.customId==='ticket_close') {
      const t=db.tickets[i.channelId];if(!t||t.status!=='open') return i.reply({content:'Ticket já fechado.',flags:MessageFlags.Ephemeral});
      if(i.user.id!==t.owner&&!staff(i)) return i.reply({content:'Somente o cliente ou a equipe pode fechar.',flags:MessageFlags.Ephemeral});
      await i.deferReply();t.status='closed';t.closedAt=new Date().toISOString();t.closedBy=i.user.id;save();
      await i.channel.permissionOverwrites.edit(t.owner,{ViewChannel:false,SendMessages:false});
      await i.editReply({embeds:[embed('🔒 Ticket encerrado',`Fechado por ${i.user}. Obrigado por utilizar nosso suporte!\n\nO cliente receberá um convite para avaliar o atendimento por mensagem privada.`)],components:controls(true)});
      await log(i.guild,'🔒 Ticket fechado',`Ticket #${t.id} • Cliente: <@${t.owner}>\nFechado por: ${i.user}\nAtendente: ${t.claimer?`<@${t.claimer}>`:'Não assumido'}\nCanal: ${i.channel}`);
      try{const user=await client.users.fetch(t.owner);const buttons=new ActionRowBuilder().addComponents([1,2,3,4,5].map(n=>new ButtonBuilder().setCustomId(`review_${i.channelId}_${n}`).setLabel(`${n} ⭐`).setStyle(n===5?ButtonStyle.Success:ButtonStyle.Secondary)));await user.send({embeds:[embed(`⭐ Avalie o atendimento #${t.id}`,`Qual nota você dá para o atendimento da **${config.storeName}**? Escolha de 1 a 5 estrelas.`)],components:[buttons]});}catch(e){await i.channel.send('ℹ️ Não foi possível enviar a avaliação por DM ao cliente. Ele pode estar com mensagens privadas bloqueadas.');}
      return;
    }
    if(i.isButton() && i.customId.startsWith('review_')) {
      const match=/^review_(\d+)_(\d)$/.exec(i.customId);if(!match)return;
      const [_,chId,note]=match;const t=db.tickets[chId];if(!t||t.status!=='closed'||t.owner!==i.user.id)return i.reply({content:'Você não pode avaliar este ticket.',flags:MessageFlags.Ephemeral});
      if(db.reviews[chId]) return i.reply({content:'Este ticket já foi avaliado.',flags:MessageFlags.Ephemeral});
      db.reviews[chId]={rating:Number(note),user:i.user.id,at:new Date().toISOString()};save();
      try{const ch=await client.channels.fetch(process.env.REVIEW_CHANNEL_ID);if(ch?.isTextBased())await ch.send({embeds:[embed('⭐ Nova avaliação',`**Ticket:** #${t.id}\n**Cliente:** ${i.user}\n**Atendente:** ${t.claimer?`<@${t.claimer}>`:'Não informado'}\n**Nota:** ${'⭐'.repeat(Number(note))} (${note}/5)`)]});}catch(err){console.error('Avaliação:',err.message)}
      await log(client.guilds.cache.get(process.env.GUILD_ID),'Nova avaliação',`Ticket #${t.id}: ${note}/5 por ${i.user}.`);
      return i.update({content:`Obrigado pela avaliação! Sua nota foi **${note}/5**.`,embeds:[],components:[]});
    }
  }catch(error){console.error('Interação:',error);const payload={content:'Ocorreu um erro. Verifique permissões, IDs e o console.',flags:MessageFlags.Ephemeral};try {if(i.deferred||i.replied)await i.followUp(payload);else await i.reply(payload);}catch{}}
});
client.login(process.env.DISCORD_TOKEN);
