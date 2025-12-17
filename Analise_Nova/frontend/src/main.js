// Variáveis globais
let pdfViewer = null;
let resultsGallery = null;
let currentSessionId = null; // Armazena sessionId do PDF atual

document.addEventListener('DOMContentLoaded', () => {
    // Verificar se as classes estão definidas
    if (typeof PDFViewer === 'undefined') {
        console.error('PDFViewer não está definido. Verifique se pdf-viewer.js foi carregado corretamente.');
        return;
    }
    
    if (typeof ResultsGallery === 'undefined') {
        console.error('ResultsGallery não está definido. Verifique se results-gallery.js foi carregado corretamente.');
        return;
    }
    
    // Inicializar componentes
    pdfViewer = new PDFViewer('pdf-viewer');
    resultsGallery = new ResultsGallery('results-gallery');

    // Elementos do DOM
    const uploadForm = document.getElementById('uploadForm');
    const uploadSection = document.getElementById('upload-section');
    const methodSelectionSection = document.getElementById('method-selection-section');
    const viewerSection = document.getElementById('viewer-section');
    const resultsSection = document.getElementById('results-section');
    const btnExtract = document.getElementById('btn-extract');
    const btnClear = document.getElementById('btn-clear');
    const btnBack = document.getElementById('btn-back');
    const btnNewExtraction = document.getElementById('btn-new-extraction');
    const btnAutoExtract = document.getElementById('btn-auto-extract');
    const btnManualSelect = document.getElementById('btn-manual-select');
    const uploadStatus = document.getElementById('upload-status');
    const methodStatus = document.getElementById('method-status');
    const viewerStatus = document.getElementById('viewer-status');
    const resultsStatus = document.getElementById('results-status');
    const fileInput = document.getElementById('arquivoInput');
    const fileLabel = document.querySelector('.file-label');

    // Handler para mostrar nome do arquivo selecionado
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const fileName = this.files[0].name;
            const fileSize = (this.files[0].size / 1024 / 1024).toFixed(2); // MB
            fileLabel.textContent = `${fileName} (${fileSize} MB)`;
            fileLabel.classList.add('file-selected');
        } else {
            fileLabel.textContent = 'Escolher arquivo PDF';
            fileLabel.classList.remove('file-selected');
        }
    });

    // Handler de upload de PDF
    uploadForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const formData = new FormData(this);

        if (!fileInput.files[0]) {
            showStatus(uploadStatus, 'Por favor, selecione um arquivo PDF.', 'error');
            return;
        }

        showStatus(uploadStatus, 'Carregando PDF...', 'loading');

        try {
            // Enviar PDF para obter páginas renderizadas
            const response = await axios.post('http://localhost:5000/obter-paginas', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.status === 'sucesso') {
                // Salvar sessionId para uso posterior (evita reenviar PDF completo)
                currentSessionId = response.data.sessionId;

                // Carregar páginas no visualizador (para uso futuro na seleção manual)
                await pdfViewer.loadPages(response.data.value.imagens_encontradas);

                // Mostrar seção de escolha de método
                uploadSection.style.display = 'none';
                methodSelectionSection.style.display = 'block';
                viewerSection.style.display = 'none';
                resultsSection.style.display = 'none';

                showStatus(uploadStatus, '', '');
                showStatus(methodStatus, `PDF carregado com sucesso! ${response.data.value.total_paginas} página(s). Escolha o método de extração.`, 'success');
            } else {
                showStatus(uploadStatus, response.data.message || 'Erro ao processar PDF', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar PDF:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Erro ao carregar PDF';
            showStatus(uploadStatus, errorMessage, 'error');
        }
    });

    // Handler de extração de seleções
    btnExtract.addEventListener('click', async function () {
        const selections = pdfViewer.getSelections();

        if (selections.length === 0) {
            showStatus(viewerStatus, 'Nenhuma seleção feita. Por favor, selecione áreas no PDF.', 'error');
            return;
        }

        if (!currentSessionId) {
            showStatus(viewerStatus, 'Erro: Sessão do PDF não encontrada. Por favor, faça upload novamente.', 'error');
            return;
        }

        showStatus(viewerStatus, `Processando ${selections.length} seleção(ões)...`, 'loading');

        try {
            const response = await axios.post('http://localhost:5000/extrair-regioes', {
                sessionId: currentSessionId,
                selecoes: selections
            });

            if (response.data.status === 'sucesso') {
                // Limpar galeria e adicionar novas imagens
                resultsGallery.clear();
                resultsGallery.addImages(response.data.value.imagens_extraidas);

                // Mostrar seção de resultados
                uploadSection.style.display = 'none';
                viewerSection.style.display = 'none';
                resultsSection.style.display = 'block';

                const successCount = response.data.value.imagens_extraidas.filter(img => img.status === 'sucesso').length;
                showStatus(resultsStatus, `${successCount} imagem(ns) extraída(s) com sucesso!`, 'success');
            } else {
                showStatus(viewerStatus, response.data.message || 'Erro ao extrair regiões', 'error');
            }
        } catch (error) {
            console.error('Erro ao extrair regiões:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Erro ao extrair regiões';
            showStatus(viewerStatus, errorMessage, 'error');
        }
    });

    // Handler de remover última seleção
    btnClear.addEventListener('click', function () {
        const removed = pdfViewer.removeLastSelection();
        if (removed) {
            showStatus(viewerStatus, 'Última seleção removida.', 'success');
        } else {
            showStatus(viewerStatus, 'Nenhuma seleção para remover.', 'info');
        }
    });

    // Handler de extração automática
    btnAutoExtract.addEventListener('click', async function () {
        if (!currentSessionId) {
            showStatus(methodStatus, 'Erro: Sessão do PDF não encontrada. Por favor, faça upload novamente.', 'error');
            return;
        }

        showStatus(methodStatus, 'Extraindo imagens automaticamente...', 'loading');

        try {
            const response = await axios.post('http://localhost:5000/extrair-imagens-automaticas', {
                sessionId: currentSessionId
            });

            if (response.data.status === 'sucesso') {
                // Limpar galeria e adicionar novas imagens
                resultsGallery.clear();
                resultsGallery.addImages(response.data.value.imagens_extraidas);

                // Mostrar seção de resultados
                uploadSection.style.display = 'none';
                methodSelectionSection.style.display = 'none';
                viewerSection.style.display = 'none';
                resultsSection.style.display = 'block';

                const successCount = response.data.value.imagens_extraidas.filter(img => img.status === 'sucesso').length;
                showStatus(resultsStatus, `${successCount} imagem(ns) extraída(s) automaticamente!`, 'success');
            } else {
                showStatus(methodStatus, response.data.message || 'Erro ao extrair imagens automaticamente', 'error');
            }
        } catch (error) {
            console.error('Erro ao extrair imagens automáticas:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Erro ao extrair imagens automaticamente';
            showStatus(methodStatus, errorMessage, 'error');
        }
    });

    // Handler de seleção manual
    btnManualSelect.addEventListener('click', function () {
        // Mostrar seção de visualização para seleção manual
        uploadSection.style.display = 'none';
        methodSelectionSection.style.display = 'none';
        viewerSection.style.display = 'block';
        resultsSection.style.display = 'none';
        showStatus(viewerStatus, 'Clique e arraste para selecionar áreas no PDF.', 'info');
    });

    // Handler de voltar
    btnBack.addEventListener('click', function () {
        uploadSection.style.display = 'none';
        methodSelectionSection.style.display = 'block';
        viewerSection.style.display = 'none';
        resultsSection.style.display = 'none';
        pdfViewer.clearSelections();
    });

    // Handler de nova extração
    btnNewExtraction.addEventListener('click', function () {
        uploadSection.style.display = 'block';
        methodSelectionSection.style.display = 'none';
        viewerSection.style.display = 'none';
        resultsSection.style.display = 'none';
        pdfViewer.clearSelections();
        resultsGallery.clear();
        currentSessionId = null;
        uploadForm.reset();
        // Resetar label também
        fileLabel.textContent = 'Escolher arquivo PDF';
        fileLabel.classList.remove('file-selected');
    });

    /**
     * Função auxiliar para mostrar mensagens de status
     */
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = 'status-message';
        
        if (type) {
            element.classList.add(`status-${type}`);
        }
        
        // Limpar mensagem após 5 segundos (exceto para loading)
        if (type !== 'loading' && message) {
            setTimeout(() => {
                if (element.textContent === message) {
                    element.textContent = '';
                    element.className = 'status-message';
                }
            }, 5000);
        }
    }

});
