const { PDFDocument, PDFName } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path'); 
const pako = require('pako');

// --- Configurações ---
const INPUT_PATH = "PDFarchive/Manual Monpar Speed Brake 11_07_18.pdf";
const OUTPUT_DIR = "imagens_extraidas";

// Cria o diretório de saída
const outputDirPath = path.join(process.cwd(), OUTPUT_DIR);
if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
}

// Função robusta para decodificar filtros do PDF
function decodificarFiltro(data, filterName) {
    if (!filterName || !data || data.length === 0) return data;
    
    const filter = typeof filterName === 'string' ? filterName : 
                  (filterName.name || filterName.toString() || '');
    
    // FlateDecode = compressão zlib/deflate
    if (filter === 'FlateDecode' || filter === '/FlateDecode' || filter.includes('FlateDecode')) {
        try {
            return pako.inflate(data);
        } catch (e) {
            try {
                return pako.inflateRaw(data);
            } catch (e2) {
                return data;
            }
        }
    }
    
    // DCTDecode geralmente já é JPEG, não precisa decodificar
    if (filter === 'DCTDecode' || filter === '/DCTDecode') {
        return data;
    }
    
    return data;
}

// Função auxiliar para criar buffer RGBA a partir de dados raw
function criarBufferRGBA(imageData, width, height, isGrayscale, invertVertical = false) {
    const rawBuffer = Buffer.alloc(width * height * 4);
    
    if (isGrayscale) {
        // Grayscale: processa linha por linha
        for (let y = 0; y < height; y++) {
            const srcRow = y * width;
            const dstY = invertVertical ? (height - 1 - y) : y;
            const dstRow = dstY * width;
            
            for (let x = 0; x < width; x++) {
                const gray = imageData[srcRow + x];
                const rgbaIdx = (dstRow + x) * 4;
                rawBuffer[rgbaIdx] = gray;     // R
                rawBuffer[rgbaIdx + 1] = gray;  // G
                rawBuffer[rgbaIdx + 2] = gray;  // B
                rawBuffer[rgbaIdx + 3] = 255;   // Alpha
            }
        }
    } else {
        // RGB: processa linha por linha
        for (let y = 0; y < height; y++) {
            const srcRow = y * width * 3;
            const dstY = invertVertical ? (height - 1 - y) : y;
            const dstRow = dstY * width;
            
            for (let x = 0; x < width; x++) {
                const srcIdx = srcRow + (x * 3);
                const rgbaIdx = (dstRow + x) * 4;
                rawBuffer[rgbaIdx] = imageData[srcIdx];         // R
                rawBuffer[rgbaIdx + 1] = imageData[srcIdx + 1]; // G
                rawBuffer[rgbaIdx + 2] = imageData[srcIdx + 2]; // B
                rawBuffer[rgbaIdx + 3] = 255;                   // Alpha
            }
        }
    }
    
    return rawBuffer;
}

// Função para processar imagem raw usando sharp
async function processarImagemRaw(imageData, width, height, colorSpace, bitsPerComponent = 8, invertVertical = false) {
    try {
        const colorSpaceName = typeof colorSpace === 'string' ? colorSpace : 
                              (colorSpace?.name || colorSpace?.key || 'DeviceRGB');
        const isGrayscale = colorSpaceName === 'DeviceGray' || colorSpaceName === '/DeviceGray';
        
        // Calcula o tamanho esperado dos dados
        const bytesPerPixel = isGrayscale ? 1 : 3;
        const expectedSize = width * height * bytesPerPixel;
        
        // Se os dados não correspondem ao tamanho esperado, ajusta
        if (imageData.length !== expectedSize) {
            // Pode haver padding ou dados extras
            if (imageData.length < expectedSize) {
                throw new Error(`Dados insuficientes: esperado ${expectedSize}, obtido ${imageData.length}`);
            }
            // Se houver dados extras, pega apenas o necessário
            imageData = imageData.slice(0, expectedSize);
        }
        
        // Cria o buffer RGBA com a orientação especificada
        let rawBuffer = criarBufferRGBA(imageData, width, height, isGrayscale, invertVertical);
        
        // Valida dimensões
        if (width <= 0 || height <= 0) {
            throw new Error(`Dimensões inválidas: ${width}x${height}`);
        }
        
        // Valida tamanho do buffer
        const expectedBufferSize = width * height * 4;
        if (rawBuffer.length !== expectedBufferSize) {
            throw new Error(`Tamanho do buffer incorreto: esperado ${expectedBufferSize}, obtido ${rawBuffer.length}`);
        }
        
        // Usa sharp para processar e salvar como PNG de alta qualidade
        const pngBuffer = await sharp(rawBuffer, {
            raw: {
                width: parseInt(width),
                height: parseInt(height),
                channels: 4
            }
        })
        .png({
            quality: 100,
            compressionLevel: 6,
            adaptiveFiltering: true
        })
        .toBuffer();
        
        return pngBuffer;
    } catch (error) {
        throw new Error(`Erro ao processar imagem raw: ${error.message}`);
    }
}

async function processarPDF() {
    try {
        const pdfPath = path.join(process.cwd(), INPUT_PATH);
        
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`Arquivo PDF não encontrado: ${pdfPath}`);
        }

        console.log('\n📄 Carregando PDF...');
        
        const pdfBytes = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

        console.log(`📄 PDF carregado: ${pdfDoc.getPageCount()} página(s)`);

        const extractedImages = [];
        const seenImages = new Set();

        // Itera sobre cada página
        for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex++) {
            const page = pdfDoc.getPage(pageIndex);
            const resources = page.node.Resources();
            const xObjects = resources.get(PDFName.of("XObject"));

            if (xObjects) {
                for (const [key, ref] of xObjects.dict) {
                    try {
                        const pdfImage = pdfDoc.context.lookup(ref);
                        
                        // Obtém informações da imagem
                        const widthObj = pdfImage.dict.get(PDFName.of("Width"));
                        const heightObj = pdfImage.dict.get(PDFName.of("Height"));
                        const width = widthObj ? (typeof widthObj.valueOf === 'function' ? widthObj.valueOf() : widthObj) : null;
                        const height = heightObj ? (typeof heightObj.valueOf === 'function' ? heightObj.valueOf() : heightObj) : null;
                        
                        if (!width || !height || width <= 0 || height <= 0) {
                            continue;
                        }
                        const filterObj = pdfImage.dict.get(PDFName.of("Filter"));
                        const colorSpaceObj = pdfImage.dict.get(PDFName.of("ColorSpace"));
                        const bitsPerComponentObj = pdfImage.dict.get(PDFName.of("BitsPerComponent"));
                        
                        // Obtém os dados brutos
                        const rawBytes = await pdfImage.asUint8Array();
                        
                        // Determina o filtro usado
                        let filter = null;
                        if (filterObj) {
                            filter = filterObj instanceof PDFName ? filterObj.name : 
                                    (Array.isArray(filterObj) ? filterObj[0]?.name : filterObj?.name);
                        }
                        
                        // Determina o espaço de cor
                        let colorSpace = 'DeviceRGB';
                        if (colorSpaceObj) {
                            const cs = colorSpaceObj instanceof PDFName ? colorSpaceObj.name : 
                                      (colorSpaceObj?.name || colorSpaceObj?.key);
                            colorSpace = cs || 'DeviceRGB';
                        }
                        
                        // Obtém bits por componente
                        let bitsPerComponent = 8;
                        if (bitsPerComponentObj) {
                            bitsPerComponent = bitsPerComponentObj.valueOf() || 8;
                        }
                        
                        let imageData = Buffer.from(rawBytes);
                        
                        // Decodifica filtros
                        if (filter) {
                            imageData = Buffer.from(decodificarFiltro(imageData, filter));
                        } else if (rawBytes[0] === 0x78) {
                            // Se começa com zlib, tenta descomprimir
                            try {
                                imageData = Buffer.from(pako.inflate(imageData));
                            } catch (e) {
                                // Mantém original
                            }
                        }
                        
                        // Verifica se já é uma imagem válida
                        const isJPEG = imageData[0] === 0xFF && imageData[1] === 0xD8;
                        const isPNG = imageData[0] === 0x89 && imageData[1] === 0x50 && 
                                     imageData[2] === 0x4E && imageData[3] === 0x47;
                        
                        let finalImageData = null;
                        let mimeType = null;
                        let extension = null;
                        
                        if (isJPEG) {
                            // JPEG válido - usa sharp para garantir qualidade
                            finalImageData = await sharp(imageData)
                                .jpeg({ quality: 100 })
                                .toBuffer();
                            mimeType = "image/jpeg";
                            extension = "jpg";
                        } else if (isPNG) {
                            // PNG válido - usa sharp para garantir qualidade
                            finalImageData = await sharp(imageData)
                                .png({ quality: 100, compressionLevel: 6 })
                                .toBuffer();
                            mimeType = "image/png";
                            extension = "png";
                        } else {
                            // Dados raw do PDF - processa usando sharp
                            // Tenta primeiro sem inverter (ordem normal)
                            try {
                                finalImageData = await processarImagemRaw(
                                    imageData, 
                                    width, 
                                    height, 
                                    colorSpace,
                                    bitsPerComponent,
                                    false // não inverte - ordem normal
                                );
                                mimeType = "image/png";
                                extension = "png";
                            } catch (convError) {
                                console.warn(`      ⚠️  Erro ao processar imagem na página ${pageIndex + 1}: ${convError.message}`);
                                continue;
                            }
                        }
                        
                        if (finalImageData && finalImageData.length > 100) {
                            // Cria uma chave única para evitar duplicatas
                            const imageKey = finalImageData.length + '_' + 
                                           Array.from(finalImageData.slice(0, 20)).join(',');
                            
                            if (!seenImages.has(imageKey)) {
                                seenImages.add(imageKey);
                                
                                extractedImages.push({
                                    data: finalImageData,
                                    mimeType: mimeType,
                                    extension: extension,
                                    pageNumber: pageIndex + 1,
                                    width: width,
                                    height: height
                                });
                                
                                const colorInfo = colorSpace === 'DeviceGray' ? ' (Grayscale)' : '';
                                console.log(`   ✓ Imagem encontrada na página ${pageIndex + 1}: ${width}x${height} (${extension.toUpperCase()}${colorInfo})`);
                            }
                        }
                    } catch (err) {
                        // Ignora erros ao processar imagens individuais
                    }
                }
            }
        }

        if (extractedImages.length === 0) {
            console.log('\n⚠️  Nenhuma imagem encontrada no PDF.');
            return;
        }

        console.log(`\n✅ Total de ${extractedImages.length} imagem(ns) encontrada(s)!`);
        console.log('💾 Salvando imagens com alta qualidade...');

        // Salva as imagens
        for (let i = 0; i < extractedImages.length; i++) {
            const img = extractedImages[i];
            const fileName = `imagem_${i + 1}.${img.extension}`;
            const filePath = path.join(outputDirPath, fileName);

            // Salva os bytes diretamente
            fs.writeFileSync(filePath, img.data);
            
            const stats = fs.statSync(filePath);
            console.log(`   [${i + 1}/${extractedImages.length}] ${fileName} (${img.width}x${img.height}, ${(stats.size / 1024).toFixed(2)} KB)`);
        }

        console.log(`\n✅ Processo concluído! ${extractedImages.length} imagem(ns) salva(s) na pasta: ${OUTPUT_DIR}`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.stack) console.error('Stack:', error.stack);
    }
}

processarPDF();
