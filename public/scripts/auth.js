document.addEventListener("DOMContentLoaded", function () {
    // Função para verificar se o elemento existe antes de manipular
    function setElementDisplay(elementId, displayValue) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = displayValue;
        } else {
            console.error(`Elemento com ID ${elementId} não encontrado.`);
        }
    }

    // Função setupUI para configurar a interface dependendo do status de autenticação
    function setupUI(user = null) {
        if (user) {
            // Se o usuário está logado, exibe os elementos relacionados
            setElementDisplay("code-generator", "block");
            setElementDisplay("user-details", "block");
            document.getElementById('user-details').textContent = user.email;
        } else {
            // Se o usuário está deslogado, oculta os elementos relacionados
            setElementDisplay("code-generator", "none");
            setElementDisplay("user-details", "none");
        }
    }

    // Ouvir mudanças no status de autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário logado");
            console.log(user);
            setupUI(user);

            // Exibir o gerador de código e detalhes do usuário
            setElementDisplay("code-generator", "block");
            setElementDisplay("user-details", "block");
            document.getElementById('user-details').textContent = user.email;
        } else {
            console.log("Usuário deslogado");
            setupUI();

            // Ocultar todos os elementos relacionados ao login
            setElementDisplay("code-generator", "none");
            setElementDisplay("user-details", "none");
            setElementDisplay("authentication-bar", "none");
            setElementDisplay("content-sign-in", "none");
            setElementDisplay("login-form", "block"); // Exibe o formulário de login
        }
    });

    // Selecionar o botão de geração de código
    const generateCodeButtonElement = document.getElementById('generateCodeButton');
    if (generateCodeButtonElement) {
        generateCodeButtonElement.addEventListener('click', () => {
            // Lógica para gerar código
            const expirationTime = document.getElementById("expirationTimeInput").value;
            const generatedCode = "Código gerado: " + Math.random().toString(36).substring(2, 8); // Exemplo simples
            document.getElementById("code-display").textContent = generatedCode;

            // Aqui você pode adicionar a lógica para salvar o código gerado e configurar a expiração, se necessário.
        });
    }

    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const email = document.getElementById('input-email').value;
            const password = document.getElementById('input-password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    loginForm.reset();
                    console.log(email);
                    setElementDisplay('authentication-bar', 'block');
                    setElementDisplay('content-sign-in', 'block');
                    setElementDisplay('login-form', 'none');
                    document.getElementById('user-details').textContent = userCredential.user.email;
                })
                .catch((error) => {
                    document.getElementById('error-message').textContent = error.message;
                });
        });
    } else {
        console.error('Formulário de login não encontrado.');
    }

    // Logout
    const logout = document.getElementById('logout-link');
    if (logout) {
        logout.addEventListener('click', function(event) {
            event.preventDefault();
            auth.signOut().then(() => {
                // Ocultar todos os elementos do usuário após logout
                setElementDisplay('authentication-bar', 'none');
                setElementDisplay('content-sign-in', 'none');
                setElementDisplay('code-generator', 'none');
                setElementDisplay('user-details', 'none');
                setElementDisplay('login-form', 'block'); // Exibir o formulário de login
            });
        });
    } else {
        console.error('Elemento de logout não encontrado.');
    }

    // Certifique-se de que Highcharts esteja carregado
    if (document.getElementById('chartContainer')) {
        createTemperatureChart();
    }

    // Centralização do botão de logout
    const logoutButton = document.getElementById("logout-link");
    if (logoutButton) {
        logoutButton.style.display = "block";
        logoutButton.style.margin = "0 auto";  // Centraliza horizontalmente
        logoutButton.style.textAlign = "center";  // Centraliza o texto no botão
    } else {
        console.error('Botão de logout não encontrado.');
    }
});
