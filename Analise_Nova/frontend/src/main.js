// Variáveis globais
let pdfViewer = null;
let resultsGallery = null;
let currentSessionId = null; // Armazena sessionId do PDF atual
let automaticImages = []; // Armazena imagens extraídas automaticamente para combinação

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
    const btnCombinedExtract = document.getElementById('btn-combined-extract');
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

    // Handler de extração de seleções (pode incluir imagens automáticas)
    btnExtract.addEventListener('click', async function () {
        const selections = pdfViewer.getSelections();

        // Verificar se há seleções manuais ou imagens automáticas
        if (selections.length === 0 && automaticImages.length === 0) {
            showStatus(viewerStatus, 'Nenhuma seleção feita. Por favor, selecione áreas no PDF ou use a opção "Automático + Manual".', 'error');
            return;
        }
        
        // Se houver apenas imagens automáticas (sem seleções manuais), mostrar resultados diretamente
        if (selections.length === 0 && automaticImages.length > 0) {
            resultsGallery.clear();
            resultsGallery.addImages(automaticImages);
            
            uploadSection.style.display = 'none';
            methodSelectionSection.style.display = 'none';
            viewerSection.style.display = 'none';
            resultsSection.style.display = 'block';
            
            showStatus(resultsStatus, `${automaticImages.length} imagem(ns) extraída(s) automaticamente!`, 'success');
            automaticImages = [];
            return;
        }

        if (!currentSessionId) {
            showStatus(viewerStatus, 'Erro: Sessão do PDF não encontrada. Por favor, faça upload novamente.', 'error');
            return;
        }

        const totalItems = selections.length + automaticImages.length;
        showStatus(viewerStatus, `Processando ${totalItems} item(ns)...`, 'loading');

        try {
            let allImages = [];

            // Se houver imagens automáticas, adicionar primeiro
            if (automaticImages.length > 0) {
                allImages = [...automaticImages];
            }

            // Se houver seleções manuais, extrair e adicionar
            if (selections.length > 0) {
                const response = await axios.post('http://localhost:5000/extrair-regioes', {
                    sessionId: currentSessionId,
                    selecoes: selections
                });

                if (response.data.status === 'sucesso') {
                    const manualImages = response.data.value.imagens_extraidas.filter(img => img.status === 'sucesso');
                    allImages = [...allImages, ...manualImages];
                } else {
                    showStatus(viewerStatus, response.data.message || 'Erro ao extrair regiões manuais', 'error');
                    return;
                }
            }

            // Limpar galeria e adicionar todas as imagens
            resultsGallery.clear();
            resultsGallery.addImages(allImages);

            // Mostrar seção de resultados
            uploadSection.style.display = 'none';
            methodSelectionSection.style.display = 'none';
            viewerSection.style.display = 'none';
            resultsSection.style.display = 'block';

            const successCount = allImages.length;
            const autoCount = automaticImages.length;
            const manualCount = selections.length;
            let message = `${successCount} imagem(ns) extraída(s) com sucesso!`;
            if (autoCount > 0 && manualCount > 0) {
                message += ` (${autoCount} automáticas + ${manualCount} manuais)`;
            } else if (autoCount > 0) {
                message += ` (${autoCount} automáticas)`;
            } else {
                message += ` (${manualCount} manuais)`;
            }
            showStatus(resultsStatus, message, 'success');
            
            // Limpar imagens automáticas após exibir resultados
            automaticImages = [];
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
        // Limpar imagens automáticas anteriores
        automaticImages = [];
        
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
        // Limpar imagens automáticas se houver
        automaticImages = [];
        // Mostrar seção de visualização para seleção manual
        uploadSection.style.display = 'none';
        methodSelectionSection.style.display = 'none';
        viewerSection.style.display = 'block';
        resultsSection.style.display = 'none';
        showStatus(viewerStatus, 'Clique e arraste para selecionar áreas no PDF.', 'info');
    });

    // Handler de extração combinada (automática + manual)
    btnCombinedExtract.addEventListener('click', async function () {
        if (!currentSessionId) {
            showStatus(methodStatus, 'Erro: Sessão do PDF não encontrada. Por favor, faça upload novamente.', 'error');
            return;
        }

        showStatus(methodStatus, 'Extraindo imagens automaticamente...', 'loading');

        try {
            // Primeiro, executar extração automática
            const response = await axios.post('http://localhost:5000/extrair-imagens-automaticas', {
                sessionId: currentSessionId
            });

            if (response.data.status === 'sucesso') {
                // Armazenar imagens automáticas
                automaticImages = response.data.value.imagens_extraidas.filter(img => img.status === 'sucesso');
                
                // Mostrar seção de visualização para adicionar seleções manuais
                uploadSection.style.display = 'none';
                methodSelectionSection.style.display = 'none';
                viewerSection.style.display = 'block';
                resultsSection.style.display = 'none';
                
                showStatus(viewerStatus, `${automaticImages.length} imagem(ns) extraída(s) automaticamente! Agora você pode adicionar seleções manuais adicionais.`, 'success');
            } else {
                showStatus(methodStatus, response.data.message || 'Erro ao extrair imagens automaticamente', 'error');
            }
        } catch (error) {
            console.error('Erro ao extrair imagens automáticas:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Erro ao extrair imagens automaticamente';
            showStatus(methodStatus, errorMessage, 'error');
        }
    });

    // Handler de voltar
    btnBack.addEventListener('click', function () {
        uploadSection.style.display = 'none';
        methodSelectionSection.style.display = 'block';
        viewerSection.style.display = 'none';
        resultsSection.style.display = 'none';
        pdfViewer.clearSelections();
        automaticImages = []; // Limpar imagens automáticas ao voltar
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
        automaticImages = []; // Limpar imagens automáticas
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
