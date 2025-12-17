// Elementos DOM
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const editorSection = document.getElementById('editorSection');
const editorCanvas = document.getElementById('editorCanvas');
const clearButton = document.getElementById('clearButton');
const brushSize = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const instructionInput = document.getElementById('instructionInput');
const submitButton = document.getElementById('submitButton');
const resultSection = document.getElementById('resultSection');
const resultCanvas = document.getElementById('resultCanvas');
const loadingSpinner = document.getElementById('loadingSpinner');
const downloadLink = document.getElementById('downloadLink');
const errorMessage = document.getElementById('errorMessage');

// Estado da aplicação
let ctx = null;
let image = null;
let isDrawing = false;
let currentBrushSize = 20;
let originalImageData = null;

// Configuração do canvas
function setupCanvas() {
    ctx = editorCanvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = currentBrushSize;
}

// Atualizar tamanho do pincel
brushSize.addEventListener('input', (e) => {
    currentBrushSize = parseInt(e.target.value);
    brushSizeValue.textContent = currentBrushSize + 'px';
    if (ctx) {
        ctx.lineWidth = currentBrushSize;
    }
});

// Função para carregar imagem
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showError('Por favor, selecione um arquivo de imagem válido.');
        return;
    }

    fileName.textContent = file.name;
    hideError();

    const reader = new FileReader();
    reader.onload = (e) => {
        image = new Image();
        image.onload = () => {
            // Configurar tamanho do canvas baseado na imagem
            const maxWidth = 800;
            const maxHeight = 600;
            let width = image.width;
            let height = image.height;

            // Redimensionar se necessário mantendo proporção
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;
            }

            editorCanvas.width = width;
            editorCanvas.height = height;
            setupCanvas();

            // Desenhar imagem no canvas
            ctx.drawImage(image, 0, 0, width, height);
            
            // Salvar estado original da imagem
            originalImageData = ctx.getImageData(0, 0, width, height);

            // Mostrar seção de edição
            editorSection.style.display = 'block';
            resultSection.style.display = 'none';
        };
        image.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Configurar eventos de desenho no canvas
function setupCanvasDrawing() {
    if (!ctx) return;

    // Mouse events
    editorCanvas.addEventListener('mousedown', startDrawing);
    editorCanvas.addEventListener('mousemove', draw);
    editorCanvas.addEventListener('mouseup', stopDrawing);
    editorCanvas.addEventListener('mouseout', stopDrawing);

    // Touch events para dispositivos móveis
    editorCanvas.addEventListener('touchstart', handleTouchStart);
    editorCanvas.addEventListener('touchmove', handleTouchMove);
    editorCanvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = editorCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const rect = editorCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
    }
}

// Touch handlers
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    editorCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    editorCanvas.dispatchEvent(mouseEvent);
}

// Limpar desenho
clearButton.addEventListener('click', () => {
    if (originalImageData && ctx) {
        ctx.putImageData(originalImageData, 0, 0);
    }
});

// Gerar imagem destacada (canvas atual)
function gerarImagemDestacada() {
    return new Promise((resolve) => {
        editorCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

// Função para converter blob para File
function blobToFile(blob, fileName) {
    return new File([blob], fileName, { type: blob.type });
}

// Enviar para backend
async function enviarParaBackend() {
    const instrucao = instructionInput.value.trim();
    
    if (!instrucao) {
        showError('Por favor, descreva o que deseja fazer na área destacada.');
        return;
    }

    if (!image) {
        showError('Por favor, carregue uma imagem primeiro.');
        return;
    }

    try {
        // Desabilitar botão durante processamento
        submitButton.disabled = true;
        submitButton.textContent = '⏳ Processando...';
        
        // Mostrar loading
        loadingSpinner.style.display = 'block';
        resultSection.style.display = 'block';
        hideError();

        // Gerar imagem destacada
        const imagemDestacadaBlob = await gerarImagemDestacada();
        
        // Converter imagem original para blob
        const imagemOriginalBlob = await new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const tempCtx = canvas.getContext('2d');
            tempCtx.drawImage(image, 0, 0);
            canvas.toBlob(resolve, 'image/png');
        });

        // Criar FormData
        const formData = new FormData();
        formData.append('imagemOriginal', blobToFile(imagemOriginalBlob, 'original.png'));
        formData.append('imagemDestacada', blobToFile(imagemDestacadaBlob, 'destacada.png'));
        formData.append('instrucao', instrucao);

        // Enviar para backend
        const response = await fetch('http://localhost:3000/editar-imagem', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.status === 'sucesso') {
            // Exibir resultado
            const resultadoImg = new Image();
            resultadoImg.onload = () => {
                // Configurar tamanho do canvas de resultado
                const maxWidth = 800;
                const maxHeight = 600;
                let width = resultadoImg.width;
                let height = resultadoImg.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                resultCanvas.width = width;
                resultCanvas.height = height;
                const resultCtx = resultCanvas.getContext('2d');
                resultCtx.drawImage(resultadoImg, 0, 0, width, height);

                // Configurar download
                resultCanvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    downloadLink.href = url;
                    downloadLink.style.display = 'inline-block';
                }, 'image/png');

                loadingSpinner.style.display = 'none';
            };
            resultadoImg.src = 'data:image/png;base64,' + data.imagemProcessada;
        } else {
            throw new Error(data.message || 'Erro ao processar imagem');
        }

    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao processar imagem: ' + error.message);
        loadingSpinner.style.display = 'none';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '✨ Processar com IA';
    }
}

// Funções auxiliares
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

// Event listeners
fileInput.addEventListener('change', handleImageUpload);
submitButton.addEventListener('click', enviarParaBackend);

// Permitir Enter no textarea para enviar (Ctrl+Enter)
instructionInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        enviarParaBackend();
    }
});

// Inicializar desenho quando canvas estiver pronto
setupCanvas();
setupCanvasDrawing();
