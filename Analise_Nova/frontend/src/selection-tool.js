/**
 * Ferramenta de seleção retangular em canvas
 * Permite ao usuário clicar e arrastar para criar seleções
 */
class SelectionTool {
    constructor(canvas, pageIndex) {
        this.canvas = canvas;
        this.pageIndex = pageIndex;
        this.ctx = canvas.getContext('2d');
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.onSelectionComplete = null;
        this.selections = []; // Array para armazenar seleções já feitas

        // Salvar imagem original
        this.originalImage = new Image();
        this.originalImage.onload = () => {
            // Imagem original carregada
        };
        this.originalImage.src = canvas.toDataURL();

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        // Suporte para touch (mobile)
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Calcular coordenadas considerando o scale do canvas
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0] || e.changedTouches[0];
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY
        };
    }

    handleMouseDown(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.currentX = pos.x;
        this.currentY = pos.y;
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        this.drawSelection();
    }

    handleMouseUp(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        
        this.completeSelection();
    }

    handleMouseLeave() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.completeSelection();
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const pos = this.getTouchPos(e);
        this.isDrawing = true;
        this.startX = pos.x;
        this.startY = pos.y;
        this.currentX = pos.x;
        this.currentY = pos.y;
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (!this.isDrawing) return;
        
        const pos = this.getTouchPos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        this.drawSelection();
    }

    handleTouchEnd(e) {
        e.preventDefault();
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        const pos = this.getTouchPos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        this.completeSelection();
    }

    drawSelection() {
        // Redesenhar imagem original
        if (this.originalImage.complete) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.originalImage, 0, 0);
        }

        // Redesenhar seleções anteriores
        this.selections.forEach(sel => {
            this.drawSelectionRect(sel.x, sel.y, sel.width, sel.height);
        });

        // Calcular dimensões do retângulo atual
        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        // Desenhar seleção atual
        this.drawSelectionRect(x, y, width, height);
    }

    drawSelectionRect(x, y, width, height) {
        // Desenhar overlay semi-transparente
        this.ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
        this.ctx.fillRect(x, y, width, height);

        // Desenhar borda do retângulo
        this.ctx.strokeStyle = '#0066ff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
    }

    completeSelection() {
        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        // Ignorar seleções muito pequenas (menos de 10x10 pixels)
        if (width < 10 || height < 10) {
            // Redesenhar imagem original com seleções anteriores
            this.drawSelection();
            return;
        }

        // Adicionar seleção à lista
        this.selections.push({ x, y, width, height });

        // Manter todas as seleções visíveis
        this.drawSelection();

        // Chamar callback se definido
        if (this.onSelectionComplete) {
            this.onSelectionComplete({
                pageIndex: this.pageIndex,
                x: x,
                y: y,
                width: width,
                height: height
            });
        }
    }
}

