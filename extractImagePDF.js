const fs = require('fs');
const path = require('path');

// --- Configurações ---
const INPUT_PATH = "PDFarchive/Manual Monpar Speed Brake 11_07_18.pdf";
const OUTPUT_DIR = "imagens_extraidas";

// Cria o diretório de saída
const outputDirPath = path.join(process.cwd(), OUTPUT_DIR);
if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
}

async function processarPDF() {
    try {
        const pdfPath = path.join(process.cwd(), INPUT_PATH);
        
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`Arquivo PDF não encontrado: ${pdfPath}`);
        }

        console.log('\n📄 Carregando PDF com pdf-io...');
        
        // Importa pdf-io dinamicamente (usa módulos ES)
        const { PDFIO } = await import('pdf-io');
        
        // Lê o PDF como Buffer e usa isBuffer para evitar problemas com rimraf
        const pdfBuffer = fs.readFileSync(pdfPath);
        const extractor = new PDFIO(pdfBuffer, {
            isBuffer: true
        });

        console.log('📄 PDF carregado, extraindo imagens...');
        
        // Extrai as imagens como buffers
        const imageBuffers = await extractor.extractImages();

        if (!imageBuffers || imageBuffers.length === 0) {
            console.log('\n⚠️  Nenhuma imagem encontrada no PDF.');
            return;
        }

        console.log(`\n✅ ${imageBuffers.length} imagem(ns) extraída(s) com sucesso!`);
        
        // Salva as imagens manualmente
        imageBuffers.forEach((imageBuffer, index) => {
            const fileName = `imagem_${index + 1}.png`;
            const filePath = path.join(outputDirPath, fileName);
            
            fs.writeFileSync(filePath, imageBuffer);
            
            const stats = fs.statSync(filePath);
            console.log(`   [${index + 1}/${imageBuffers.length}] ${fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
        });

        console.log(`\n✅ Processo concluído! Imagens salvas na pasta: ${OUTPUT_DIR}`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.stack) console.error('Stack:', error.stack);
    }
}

processarPDF();
