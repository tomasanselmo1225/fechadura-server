const express = require('express');
const imap = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

// Configuração do Firebase
const firebaseCredentials = process.env.FIREBASE_CREDENTIALS
    ? JSON.parse(process.env.FIREBASE_CREDENTIALS)
    : require('./firebase-credentials.json'); // Fallback para desenvolvimento local
admin.initializeApp({
    credential: admin.credential.cert(firebaseCredentials),
    databaseURL: 'https://fechadura-eletronica-isa-default-rtdb.firebaseio.com/',
});
const db = admin.database();

// Configuração do Servidor
const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 4000; // Usa a porta do Render ou 4000 localmente

// Configuração do IMAP
const imapConfig = {
    user: "joseconstrucoesonfire@gmail.com",
    password: "ocjbzfsxlxvahccr",
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    authTimeout: 60000, // 60 segundos
    connTimeout: 60000, // 60 segundos
    socketTimeout: 60000, // 60 segundos
    tlsOptions: { rejectUnauthorized: false }, // Para teste
    imap: {
        user: "joseconstrucoesonfire@gmail.com",
        password: "ocjbzfsxlxvahccr",
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 60000 // Timeout interno
    }
};

// Função para gerar um código aleatório de 5 dígitos
function generateCode() {
    const chars = 'ABCD0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Função para gerar um UID simples
function generateUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Função para converter data de DD/MM/YYYY para YYYY-MM-DD
function convertDateFormat(dateStr) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Função para processar o e-mail e criar o código
async function processEmails(retries = 5) {
    let connection;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Tentando conectar ao servidor IMAP... (Tentativa ${attempt}/${retries})`);
            connection = await imap.connect({ imap: imapConfig.imap });
            console.log('Conexão IMAP estabelecida com sucesso!');

            console.log('Abrindo caixa de entrada...');
            await connection.openBox('INBOX');
            console.log('Caixa de entrada aberta com sucesso!');

            const searchCriteria = ['UNSEEN'];
            const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false };
            console.log('Procurando e-mails não lidos...');
            const messages = await connection.search(searchCriteria, fetchOptions);
            console.log(`Encontrados ${messages.length} e-mails não lidos.`);

            for (const item of messages) {
                const all = item.parts.find(part => part.which === 'TEXT');
                if (!all || !all.body) {
                    console.log('Nenhum corpo de e-mail encontrado para esta mensagem.');
                    continue;
                }
                const rawEmail = all.body;
                const email = await simpleParser(rawEmail);

                const subject = email.subject || '';
                const body = email.text || '';
                console.log('Assunto do e-mail:', subject);
                console.log('Corpo do e-mail:', body);

                const normalizedBody = body.toLowerCase().replace(/\s+/g, ' ').trim();
                if (normalizedBody.includes('nova reserva') && normalizedBody.includes('playtomic')) {
                    console.log('E-mail detectado com "Nova reserva" e "Playtomic".');

                    const nameMatch = body.match(/Nome\s+"?([^"\n]+)"?/i);
                    const dateMatch = body.match(/Data\s+"?([^"\n]+)"?/i);
                    const timeMatch = body.match(/Hora\s+"?([^"\n]+)"?/i);
                    const emailMatch = body.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i);

                    if (nameMatch && dateMatch && timeMatch) {
                        const name = nameMatch[1].trim();
                        const date = dateMatch[1].trim();
                        const time = timeMatch[1].trim();
                        const emailAddress = emailMatch ? emailMatch[0] : null;
                        const [startTime, endTime] = time.split(' - ').map(t => t.trim());

                        console.log(`Dados extraídos - Nome: ${name}, Data: ${date}, Hora: ${time}, Email: ${emailAddress || 'Nenhum'}`);

                        const formattedDate = convertDateFormat(date);
                        // Criar datas assumindo que o horário do e-mail é em tempo local de Lisboa (WET/WEST)
                        const startDateTime = new Date(`${formattedDate}T${startTime}`);
                        const endDateTime = new Date(`${formattedDate}T${endTime}`);

                        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                            console.log('Erro: Data ou hora inválida após conversão.');
                            continue;
                        }

                        const code = generateCode();
                        const uid = generateUID();

                        const ref = db.ref('GlobalCodes');
                        await ref.push({
                            code,
                            name,
                            email: emailAddress,
                            startDateTime: startDateTime.toISOString(),
                            endDateTime: endDateTime.toISOString(),
                            uid
                        });
                        console.log(`Código ${code} criado para ${name} (${startDateTime} - ${endDateTime}) e salvo em 'GlobalCodes'`);

                        await connection.addFlags(item.attributes.uid, ['\\Seen']);
                        console.log('E-mail marcado como lido.');
                    } else {
                        console.log('Falha ao extrair Nome, Data ou Hora do e-mail.');
                        console.log('Nome encontrado:', nameMatch ? nameMatch[1] : 'Nenhum');
                        console.log('Data encontrada:', dateMatch ? dateMatch[1] : 'Nenhum');
                        console.log('Hora encontrada:', timeMatch ? timeMatch[1] : 'Nenhum');
                        console.log('Email encontrado:', emailMatch ? emailMatch[0] : 'Nenhum');
                    }
                } else {
                    console.log('E-mail não contém "Nova reserva" e "Playtomic".');
                }
            }
            break;
        } catch (error) {
            console.error(`Erro ao processar e-mails (Tentativa ${attempt}/${retries}):`, error.message);
            console.error('Detalhes do erro:', error);
            if (attempt === retries) {
                console.log('Todas as tentativas falharam. Continuando sem processar e-mails.');
            } else {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos de intervalo
            }
        } finally {
            if (connection) {
                connection.end();
                console.log('Conexão IMAP encerrada.');
            }
        }
    }
}

// Verificar e-mails a cada minuto
setInterval(processEmails, 60000);

// Rota para testar o servidor
app.get('/', (req, res) => {
    res.send('Servidor rodando e processando e-mails!');
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});