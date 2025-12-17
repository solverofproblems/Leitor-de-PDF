/**
 * Componente de visualização de PDF
 * Renderiza todas as páginas do PDF em canvas e gerencia a visualização
 */
class PDFViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pages = [];
        this.canvases = [];
        this.selectionTools = []; // Array de SelectionTools para cada canvas
        this.selections = []; // Array de seleções: { pageIndex, x, y, width, height }
        this.canvasScales = []; // Array de fatores de escala para cada canvas
        this.currentSelection = null;
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
    }

    /**
     * Carrega páginas renderizadas no visualizador
     */
    async loadPages(pagesData) {
        this.pages = [];
        this.canvases = [];
        this.selectionTools = [];
        this.canvasScales = [];
        this.selections = [];
        this.container.innerHTML = '';

        // Ordenar páginas por chave (pagina_1, pagina_2, etc.)
        const sortedPages = Object.keys(pagesData)
            .sort((a, b) => {
                const numA = parseInt(a.split('_')[1]);
                const numB = parseInt(b.split('_')[1]);
                return numA - numB;
            });

        sortedPages.forEach((pageKey, index) => {
            const pageData = pagesData[pageKey][0];
            this.pages.push({
                pageKey: pageKey,
                pageIndex: index,
                base64Data: pageData.base64_data,
                width: pageData.largura,
                height: pageData.altura,
                dpi: pageData.dpi
            });
        });

        // Criar canvas para cada página (aguardar carregamento das imagens)
        const promises = this.pages.map((page, index) => this.createPageCanvas(page, index));
        await Promise.all(promises);
    }

    /**
     * Cria um canvas para uma página específica
     */
    createPageCanvas(page, index) {
        return new Promise((resolve) => {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'page-wrapper';
            pageWrapper.dataset.pageIndex = index;

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.dataset.pageIndex = index;
            
            const img = new Image();
            img.onload = () => {
                // Redimensionar canvas mantendo proporção e limitando tamanho máximo
                const maxWidth = 1200; // Largura máxima em pixels
                const maxHeight = 1600; // Altura máxima em pixels
                
                let canvasWidth = img.width;
                let canvasHeight = img.height;
                
                // Calcular escala se necessário
                const scaleXCalc = maxWidth / img.width;
                const scaleYCalc = maxHeight / img.height;
                const scale = Math.min(scaleXCalc, scaleYCalc, 1); // Não aumentar, apenas reduzir
                
                if (scale < 1) {
                    canvasWidth = Math.floor(img.width * scale);
                    canvasHeight = Math.floor(img.height * scale);
                }
                
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                canvas.style.maxWidth = '100%';
                canvas.style.height = 'auto';
                
                // Armazenar fator de escala para conversão de coordenadas
                const scaleX = canvasWidth / img.width;
                const scaleY = canvasHeight / img.height;
                this.canvasScales[index] = { scaleX, scaleY, originalWidth: img.width, originalHeight: img.height };
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

                pageWrapper.appendChild(canvas);
                this.container.appendChild(pageWrapper);
                this.canvases.push(canvas);

                // Aguardar um frame para garantir que o canvas foi renderizado antes de criar SelectionTool
                requestAnimationFrame(() => {
                    // Adicionar event listeners para seleção
                    this.setupSelectionHandlers(canvas, index);
                    resolve();
                });
            };
            img.onerror = () => {
                console.error(`Erro ao carregar imagem da página ${index + 1}`);
                resolve();
            };
            img.src = `data:image/png;base64,${page.base64Data}`;
        });
    }

    /**
     * Configura handlers de seleção para um canvas
     */
    setupSelectionHandlers(canvas, pageIndex) {
        const selectionTool = new SelectionTool(canvas, pageIndex, this);
        this.selectionTools[pageIndex] = selectionTool;
        
        selectionTool.onSelectionComplete = (selection) => {
            // Converter coordenadas do canvas redimensionado para coordenadas originais (300 DPI)
            const scale = this.canvasScales[pageIndex];
            if (scale) {
                const originalX = selection.x / scale.scaleX;
                const originalY = selection.y / scale.scaleY;
                const originalWidth = selection.width / scale.scaleX;
                const originalHeight = selection.height / scale.scaleY;
                
                const selectionData = {
                    pageIndex: pageIndex,
                    x: originalX,
                    y: originalY,
                    width: originalWidth,
                    height: originalHeight,
                    canvasX: selection.x,
                    canvasY: selection.y,
                    canvasWidth: selection.width,
                    canvasHeight: selection.height
                };
                
                this.selections.push(selectionData);
                console.log(`Seleção adicionada na página ${pageIndex + 1}:`, { originalX, originalY, originalWidth, originalHeight });
            }
        };
    }

    /**
     * Retorna todas as seleções feitas pelo usuário
     */
    getSelections() {
        return this.selections;
    }

    /**
     * Remove a última seleção feita pelo usuário
     */
    removeLastSelection() {
        if (this.selections.length === 0) {
            return false; // Nenhuma seleção para remover
        }
        
        // Remover a última seleção do array
        const lastSelection = this.selections.pop();
        const pageIndex = lastSelection.pageIndex;
        
        // Redesenhar todos os canvases com as seleções restantes
        this.redrawAllCanvases();
        
        return true;
    }

    /**
     * Redesenha todos os canvases com as seleções atuais
     */
    redrawAllCanvases() {
        // Limpar todas as seleções dos SelectionTools
        this.selectionTools.forEach((selectionTool, idx) => {
            if (selectionTool) {
                selectionTool.selections = [];
            }
        });
        
        // Re-adicionar seleções restantes aos SelectionTools correspondentes
        this.selections.forEach(sel => {
            const selectionTool = this.selectionTools[sel.pageIndex];
            if (selectionTool && sel.canvasX !== undefined) {
                selectionTool.selections.push({
                    x: sel.canvasX,
                    y: sel.canvasY,
                    width: sel.canvasWidth,
                    height: sel.canvasHeight
                });
            }
        });
        
        // Redesenhar todos os canvases
        this.selectionTools.forEach(selectionTool => {
            if (selectionTool) {
                selectionTool.redrawCanvas();
            }
        });
    }

    /**
     * Limpa todas as seleções (mantido para compatibilidade, mas não usado no botão)
     */
    clearSelections() {
        this.selections = [];
        
        // Limpar seleções em cada SelectionTool e redesenhar canvas
        this.selectionTools.forEach((selectionTool, pageIndex) => {
            if (selectionTool) {
                selectionTool.clearAllSelections();
            }
        });
    }
}

