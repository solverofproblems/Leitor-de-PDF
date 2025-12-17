/**
 * Componente de galeria de resultados
 * Exibe as imagens extraídas após o processamento
 */
class ResultsGallery {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.images = [];
    }

    /**
     * Limpa a galeria
     */
    clear() {
        this.images = [];
        this.container.innerHTML = '';
    }

    /**
     * Adiciona imagens à galeria
     */
    addImages(imagesData) {
        if (!Array.isArray(imagesData)) {
            console.error('imagesData deve ser um array');
            return;
        }

        imagesData.forEach((imageData, index) => {
            if (imageData.status === 'sucesso' && imageData.base64_data) {
                this.addImage(imageData, index);
            } else if (imageData.status === 'erro') {
                this.addError(imageData, index);
            }
        });
    }

    /**
     * Adiciona uma imagem individual à galeria
     */
    addImage(imageData, index) {
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'result-image-wrapper';

        const img = document.createElement('img');
        img.src = `data:image/png;base64,${imageData.base64_data}`;
        img.alt = imageData.nome || `Imagem ${index + 1}`;
        img.className = 'result-image';

        const imageInfo = document.createElement('div');
        imageInfo.className = 'result-image-info';
        
        // Determinar número da página (priorizar page_number, depois page_index + 1)
        const pageNumber = imageData.page_number || (imageData.page_index !== undefined ? imageData.page_index + 1 : 'N/A');
        
        imageInfo.innerHTML = `
            <p><strong>Nome:</strong> ${imageData.nome || 'N/A'}</p>
            <p><strong>Tamanho:</strong> ${this.formatBytes(imageData.tamanho_bytes || imageData.arquivo_bytes || 0)}</p>
            ${imageData.largura && imageData.altura ? `<p><strong>Dimensões:</strong> ${imageData.largura} x ${imageData.altura} px</p>` : ''}
            <p><strong>Página:</strong> ${pageNumber}</p>
        `;

        imageWrapper.appendChild(img);
        imageWrapper.appendChild(imageInfo);
        this.container.appendChild(imageWrapper);

        this.images.push(imageData);
    }

    /**
     * Adiciona mensagem de erro à galeria
     */
    addError(errorData, index) {
        const errorWrapper = document.createElement('div');
        errorWrapper.className = 'result-error-wrapper';

        errorWrapper.innerHTML = `
            <div class="error-icon">⚠️</div>
            <p><strong>Erro na seleção ${index + 1}:</strong></p>
            <p>${errorData.message || 'Erro desconhecido'}</p>
        `;

        this.container.appendChild(errorWrapper);
    }

    /**
     * Formata bytes em formato legível
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Retorna todas as imagens da galeria
     */
    getImages() {
        return this.images;
    }

    /**
     * Retorna o número de imagens na galeria
     */
    getCount() {
        return this.images.length;
    }
}

