// Função para gerar um código aleatório de 5 dígitos
function generateRandomCode() {
    const characters = 'ABCD0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Função para enviar a notificação por e-mail com formatação correta
function sendEmailNotification(email, code, startDateTime, endDateTime, name) {
    if (!email || email.trim() === '') return; // Se o e-mail for vazio, não envia o e-mail

    // Obter a data e hora de início e término
    const start_date = startDateTime.toLocaleDateString();  // Obter a data de início
    const start_time = startDateTime.toLocaleTimeString();  // Obter a hora de início
    const end_date = endDateTime.toLocaleDateString();      // Obter a data de término
    const end_time = endDateTime.toLocaleTimeString();      // Obter a hora de término

    let message = `Você terá acesso ao campo no dia ${start_date}, às ${start_time}, e o acesso terminará no dia ${end_date}, às ${end_time}.`;

    // Inicializa o EmailJS com a chave da API
    emailjs.init("Vp-djkorU_egfpDfp");  // Verifique se a chave está correta

    // Envia o e-mail com os parâmetros necessários
    emailjs.send('service_ctsboxy', 'template_gi4xsmo', {
        to_email: email,
        subject: 'Notificação de Código Gerado',
        name,
        code,
        start_date,
        start_time,
        end_date,
        end_time,
        message
    }).then(
        (response) => {
            console.log('E-mail enviado:', response.status, response.text);
            alert('E-mail enviado com sucesso!');
        },
        (error) => {
            console.error('Erro ao enviar e-mail:', error);
            alert('Erro ao enviar e-mail: ' + error.text);  // Exibe o erro caso falhe
        }
    );
}

// Função para exibir o código gerado na interface
function displayGeneratedCode(code) {
    codeDisplayElement.innerHTML = `Código gerado: ${code}`;
}

// Função para salvar o código no Firebase e configurar a expiração automática
function saveCodeToFirebase(code, uid, startDateTime, endDateTime, name, email) {
    const codeRef = firebase.database().ref('GlobalCodes');
    const newCodeRef = codeRef.push({
        code,
        name,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        uid
    }, (error) => {
        if (error) {
            console.error("Erro ao salvar o código:", error);
        } else {
            console.log("Código salvo:", code);
            displayGeneratedCode(code);
            if (email && email.trim() !== '') sendEmailNotification(email, code, startDateTime, endDateTime, name);
            loadGlobalHistory();
        }
    });
}

// Função para carregar e sincronizar o histórico global em tempo real
function loadGlobalHistory() {
    const codeRef = firebase.database().ref('GlobalCodes');

    // Listener de alteração no Firebase
    codeRef.on('value', (snapshot) => {
        const currentTime = new Date();
        const updatedHistory = [];
    
        snapshot.forEach((childSnapshot) => {
            const { code, name, startDateTime, endDateTime } = childSnapshot.val();
            const start = new Date(startDateTime), end = new Date(endDateTime);
    
            if (currentTime < end) {
                // Adiciona os códigos válidos ao histórico atualizado
                updatedHistory.push({ code, name, start, end });
            } else {
                // Remove o código do Firebase se expirado
                childSnapshot.ref.remove()
                    .then(() => {
                        console.log(`Código ${code} expirado e removido do Firebase.`);
                    })
                    .catch(error => console.error("Erro ao remover o código expirado:", error));
            }
        });
    
        // Atualiza o histórico na interface
        displayHistory(updatedHistory);
    
        // Armazena o histórico atualizado no localStorage
        localStorage.setItem('globalHistory', JSON.stringify(updatedHistory));
    });
}

// Função para exibir o histórico na interface
function displayHistory(history) {
    const historyElement = document.getElementById('history-element');
    if (!historyElement) return; // Se o elemento não existir, saia da função

    historyElement.innerHTML = ''; // Limpa o histórico antes de renderizar
    history.forEach(({ code, name, start, end }) => {
        addToHistory(name, start, end, code);
    });
}

// Função para adicionar código ao histórico
function addToHistory(name, startDateTime, endDateTime, code) {
    const historyElement = document.getElementById('history-element');
    if (!historyElement) return; // Se o elemento não existir, saia da função

    const historyItem = document.createElement('div');
    historyItem.dataset.code = code;

    // Alteração na linha divisória para ser pontilhada e mais bonita
    historyItem.style.cssText = 'border-bottom: 2px dashed #ccc; padding: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; background-color: #f8f8f8; width: 100%; box-sizing: border-box;';

    const titleStyle = 'font-weight: bold; text-transform: uppercase; color: #333; margin-right: 10px;';
    const valueStyle = 'font-size: 14px; color: #555;';

    historyItem.innerHTML = 
        `<div style="flex: 1; display: flex; justify-content: space-between;">
            <div><span style="${titleStyle}">Código:</span> <span style="${valueStyle}">${code}</span></div>
            <div><span style="${titleStyle}">Nome:</span> <span style="${valueStyle}">${name}</span></div>
            <div><span style="${titleStyle}">Início:</span> <span style="${valueStyle}">${startDateTime.toLocaleString()}</span></div>
            <div><span style="${titleStyle}">Fim:</span> <span style="${valueStyle}">${endDateTime.toLocaleString()}</span></div>
        </div>`;

    historyElement.appendChild(historyItem);
}

// Função para remover código do histórico da interface
function removeFromHistory(code) {
    const historyElement = document.getElementById('history-element');
    if (!historyElement) return; // Se o elemento não existir, saia da função

    [...historyElement.querySelectorAll('div')].forEach(item => {
        if (item.dataset.code === code) historyElement.removeChild(item);
    });
}

// Função para remover o código imediatamente se ele tiver expirado
function removeCodeIfExpired(code, codeRef) {
    const currentTime = new Date();
    codeRef.orderByChild('code').equalTo(code).once('value').then(snapshot => {
        snapshot.forEach(childSnapshot => {
            const endDateTime = new Date(childSnapshot.val().endDateTime);
            if (currentTime > endDateTime) {
                childSnapshot.ref.remove()
                    .then(() => {
                        console.log("Código removido após expiração");
                        removeFromHistory(code);  // Remover do histórico da interface
                    })
                    .catch(error => console.error("Erro ao remover o código:", error));
            }
        });
    });
}

// Configuração dos elementos da interface
const loginElement = document.querySelector('#login-form'),
    contentElement = document.querySelector("#content-sign-in"),
    userDetailsElement = document.querySelector('#user-details'),
    authBarElement = document.querySelector('#authentication-bar'),
    codeDisplayElement = document.createElement('div'),
    expirationPanel = document.createElement('div'),
    nameInput = document.createElement('input'),
    emailInput = document.createElement('input'),
    startDateInput = document.createElement('input'), // Campo adicionado
    expirationDateInput = document.createElement('input'),
    startTimeInput = document.createElement('input'),
    endTimeInput = document.createElement('input'),
    generateCodeButtonElement = document.createElement('button'),
    historyElement = document.createElement('div');

// Função para remover completamente os elementos do DOM
function clearUIElements() {
    const elementsToRemove = [
        'expiration-panel',
        'code-display',
        'generate-code-button',
        'history-element'
    ];

    elementsToRemove.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.remove(); // Remove o elemento do DOM
        }
    });
}

// Função para criar os elementos do painel de geração de códigos
function setupUIElements() {
    // Remove os elementos existentes, se houver
    clearUIElements();

    // Cria os elementos do zero
    const expirationPanel = document.createElement('div');
    expirationPanel.id = 'expiration-panel';
    expirationPanel.style.cssText = 'display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; border: 1px solid #ccc; padding: 20px; border-radius: 10px; background-color: #f9f9f9; width: 300px; margin: 0 auto;';

    const nameInput = document.createElement('input');
    const emailInput = document.createElement('input');
    const startDateInput = document.createElement('input');
    const startTimeInput = document.createElement('input');
    const expirationDateInput = document.createElement('input');
    const endTimeInput = document.createElement('input');

    // Adicionando os campos ao painel de formulário na nova ordem
    [
        ['Nome: ', nameInput, 'text', 'Insira o Nome'],
        ['E-mail (opcional): ', emailInput, 'email', 'Digite seu e-mail'],
        ['Dia do Check-in: ', startDateInput, 'date', ''],  // Dia de Início
        ['Hora de Check-in (HH:MM): ', startTimeInput, 'time', ''], // Hora de Início
        ['Dia do Check-out: ', expirationDateInput, 'date', ''],  // Dia de Término agora abaixo da Hora de Início
        ['Hora de Check-out (HH:MM): ', endTimeInput, 'time', '']   // Hora de Término agora por último
    ].forEach(([labelText, input, type, placeholder]) => {
        const label = document.createElement('label');
        label.innerHTML = labelText;
        expirationPanel.appendChild(label); 
        input.type = type;
        input.placeholder = placeholder || '';
        input.required = true;
        expirationPanel.appendChild(input);
    });

    const codeDisplayElement = document.createElement('div');
    codeDisplayElement.id = 'code-display';
    codeDisplayElement.style.cssText = 'margin-top: 20px; font-size: 24px; font-weight: bold; color: blue; text-align: center;';

    const generateCodeButtonElement = document.createElement('button');
    generateCodeButtonElement.id = 'generate-code-button';
    generateCodeButtonElement.innerHTML = 'Gerar Código';
    generateCodeButtonElement.style.cssText = 'margin-top: 10px; width: 200px; padding: 10px; background-color: #4CAF50; color: white; border: none; cursor: pointer;';

    const historyElement = document.createElement('div');
    historyElement.id = 'history-element';
    historyElement.style.cssText = 'margin-top: 20px; padding: 10px; border: 1px solid #ccc; background-color: #f5f5f5; border-radius: 5px; max-width: 80%; margin: 0 auto; overflow-y: auto;';

    // Adiciona os elementos ao DOM
    document.body.append(expirationPanel, codeDisplayElement, generateCodeButtonElement, historyElement);

    // Configura o evento de clique no botão de gerar código
    generateCodeButtonElement.addEventListener('click', () => {
        const name = nameInput.value;
        const email = emailInput.value;
        const startDate = startDateInput.value;
        const expirationDate = expirationDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (startDate && expirationDate && startTime && endTime) {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${expirationDate}T${endTime}`);

            const code = generateRandomCode();
            saveCodeToFirebase(code, 'some-uid', startDateTime, endDateTime, name, email);

            // Exibe a mensagem de "Código gerado"
            codeDisplayElement.textContent = `Código gerado: ${code}`;
        }
    });

    // Carrega o histórico após criar os elementos
    loadGlobalHistory();
}

// Função de inicialização
function init() {
    // Exibe o painel de login inicialmente
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('content-sign-in').style.display = 'none';

    // Configura o evento de login
    loginElement.addEventListener('submit', (event) => {
        event.preventDefault();
        // Lógica de autenticação aqui (exemplo: Firebase Auth)
        // Se a autenticação for bem-sucedida:
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('content-sign-in').style.display = 'block';
        setupUIElements();
    });

    // Verifica códigos expirados e atualiza o histórico a cada 5 segundos
    setInterval(() => {
        loadGlobalHistory(); // Atualiza o histórico e remove códigos expirados
    }, 5000); // Executa a cada 5 segundos
}

init();