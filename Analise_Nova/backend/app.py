from flask import Flask, request, jsonify
import base64
import os
import fitz


app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Constantes
DPI_RENDERIZACAO = 300
DPI_PDF = 72
FATOR_CONVERSAO = DPI_RENDERIZACAO / DPI_PDF

def extrair_imgPDFKV(pdf_bytes:bytes, nome_arquivo:str) -> dict:
    """
    Extrai imagens automaticamente do PDF que já possuem padrão decodificado.
    Retorna imagens organizadas por página.
    """
    doc = fitz.open('pdf', pdf_bytes)

    img_por_pagina = {}

    total_img_extraida = 0

    # Diretório de saída
    saida_dir = "img_extraida"
    os.makedirs(saida_dir, exist_ok=True)

    prefixo_name = os.path.basename(nome_arquivo).split('.')[0]

    try:

        for page_index in range(len(doc)):
            page = doc[page_index]
            image_list = page.get_images(full=True)

            page_key = f"pagina_{page_index + 1}"

            img_por_pagina[page_key] = []

            for img_index, img_info in enumerate(image_list):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image['image']
                image_ext = base_image['ext']

                base64_string = base64.b64encode(image_bytes).decode('utf-8')

                nome_imagem = f"{prefixo_name}_p{page_index+1}_{img_index}.{image_ext}"
                caminho_saida_img = os.path.join(saida_dir, nome_imagem)

                with open(caminho_saida_img, "wb") as img_files:
                    img_files.write(image_bytes)

                img_por_pagina[page_key].append({
                    "nome": nome_imagem,
                    "extensao": image_ext,
                    "arquivo_bytes": len(image_bytes),
                    "base64_data": base64_string,
                    "page_index": page_index,  # Adicionar índice da página
                    "page_number": page_index + 1  # Número da página (1-based)
                })

                total_img_extraida += 1

        doc.close()

        return {
            "status": "sucesso",
            "message": f"{total_img_extraida} imagem(ns) extraídas com sucesso.",
            "imagens_encontradas": img_por_pagina,
            "total_imagens": total_img_extraida
        }
    
    except fitz.EmptyDocError:
        return {
            "status": "erro",
            "message": "O arquivo PDF não é válido ou está vazio."
        }
    
    except Exception as e:
        return {
            "status": "erro",
            "message": f"Erro interno ao extrair imagens: {e}"
        }



def extrair_pagina_renderizada(pdf_bytes: bytes, nome_arquivo: str, dpi: int) -> dict:

    try:
        doc = fitz.open('pdf', pdf_bytes)
    except Exception as e:
        return { "status": "erro", "message": f"Erro ao abrir o PDF: {e}" }
    
    img_por_pagina = {}
    total_paginas_processadas = 0
    
    # Parâmetros de renderização
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    
    prefixo_name = os.path.basename(nome_arquivo).split('.')[0]

    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            page_key = f"pagina_{page_index + 1}"
            
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            
            image_bytes = pix.tobytes(output="png")
            
            base64_string = base64.b64encode(image_bytes).decode('utf-8')

            img_por_pagina[page_key] = [{
                "nome": f"{prefixo_name}_p{page_index+1}_renderizado.png",
                "extensao": "png",
                "tamanho_bytes": len(image_bytes),
                "base64_data": base64_string,
                "largura": pix.width,
                "altura": pix.height,
                "dpi": dpi
            }]

            total_paginas_processadas += 1

        doc.close()

        return {
            "status": "sucesso",
            "message": f"{total_paginas_processadas} página(s) renderizadas com sucesso em {dpi} DPI.",
            "imagens_encontradas": img_por_pagina,
            "total_paginas": total_paginas_processadas
        }
    
    except Exception as e:
        doc.close()
        return {
            "status": "erro",
            "message": f"Erro interno ao renderizar páginas: {e}"
        }


def converter_coordenadas_para_pdf(x: float, y: float, width: float, height: float) -> tuple:
    """
    Converte coordenadas da renderização (300 DPI) para coordenadas do PDF (72 DPI).
    
    Args:
        x, y, width, height: Coordenadas na renderização
        
    Returns:
        Tupla (x_pdf, y_pdf, width_pdf, height_pdf)
    """
    x_pdf = x / FATOR_CONVERSAO
    y_pdf = y / FATOR_CONVERSAO
    width_pdf = width / FATOR_CONVERSAO
    height_pdf = height / FATOR_CONVERSAO
    
    return (x_pdf, y_pdf, width_pdf, height_pdf)


def extrair_regiao_especifica(pdf_bytes: bytes, nome_arquivo: str, page_index: int, 
                                x: float, y: float, width: float, height: float) -> dict:
    """
    Extrai uma região específica de uma página do PDF usando coordenadas.
    
    Args:
        pdf_bytes: Bytes do PDF
        nome_arquivo: Nome do arquivo PDF
        page_index: Índice da página (0-based)
        x, y: Coordenadas do canto superior esquerdo (em pontos do PDF, 72 DPI)
        width, height: Largura e altura da região (em pontos do PDF, 72 DPI)
        
    Returns:
        Dict com status, mensagem e dados da imagem extraída
    """
    # Diretório de saída
    saida_dir = "img_extraida"
    os.makedirs(saida_dir, exist_ok=True)
    
    prefixo_name = os.path.basename(nome_arquivo).split('.')[0]
    
    try:
        doc = fitz.open('pdf', pdf_bytes)
        
        if page_index < 0 or page_index >= len(doc):
            doc.close()
            return {
                "status": "erro",
                "message": f"Índice de página inválido: {page_index}"
            }
        
        page = doc[page_index]
        page_rect = page.rect
        
        # Validar coordenadas
        if x < 0 or y < 0 or x + width > page_rect.width or y + height > page_rect.height:
            doc.close()
            return {
                "status": "erro",
                "message": f"Coordenadas fora dos limites da página. Página: {page_rect.width}x{page_rect.height}, Seleção: x={x}, y={y}, w={width}, h={height}"
            }
        
        # Criar retângulo de recorte (coordenadas do PDF em pontos)
        rect = fitz.Rect(x, y, x + width, y + height)
        
        # Renderizar com zoom para manter qualidade (300 DPI)
        zoom = DPI_RENDERIZACAO / DPI_PDF
        matrix = fitz.Matrix(zoom, zoom)
        
        # Obter pixmap da região específica
        pix = page.get_pixmap(matrix=matrix, clip=rect, alpha=False)
        
        image_bytes = pix.tobytes(output="png")
        base64_string = base64.b64encode(image_bytes).decode('utf-8')
        
        nome_imagem = f"{prefixo_name}_p{page_index+1}_selecao_{int(x)}_{int(y)}.png"
        caminho_saida_img = os.path.join(saida_dir, nome_imagem)
        
        with open(caminho_saida_img, "wb") as img_file:
            img_file.write(image_bytes)
        
        doc.close()
        
        return {
            "status": "sucesso",
            "nome": nome_imagem,
            "extensao": "png",
            "tamanho_bytes": len(image_bytes),
            "base64_data": base64_string,
            "largura": pix.width,
            "altura": pix.height
        }
        
    except Exception as e:
        if 'doc' in locals():
            doc.close()
        return {
            "status": "erro",
            "message": f"Erro ao extrair região: {e}"
        }


@app.route('/processar-KV/', methods=['POST'])

def processar_arquivo_base64():

    dados_json = request.get_json()

    if not dados_json or 'base64_data' not in dados_json or 'nome_arquivo' not in dados_json:
        return jsonify({
            "status":"error",
            "message":"Payload JSON inválido ou incompleto."
        }), 400
    

    base64String = dados_json['base64_data']
    nome_arquivo = dados_json['nome_arquivo']

    try:

        dados_binarios = base64.b64decode(base64String)


#Análise utilizando a função "extrair_pagina_renderizada":

        resultado_pixels = extrair_pagina_renderizada(dados_binarios, nome_arquivo, 300)

        return jsonify({

            "status" : "sucesso",
            "value" : resultado_pixels

        })


#Análise utilizando a função "extrair_imgPDFKV"
        # resultado = extrair_imgPDFKV(dados_binarios, nome_arquivo)

        # return jsonify({

        #     "status":"sucesso",
        #     "value" : resultado

        # })
    
    except Exception as e:

        print('Erro no processamento do Flask, veja: {}'.format(e))
        return jsonify({
            "status":"erro",
            "messagem":"Erro interno no servidor do Python! Confira: {}".format(e)
        }), 500


@app.route('/obter-paginas-renderizadas/', methods=['POST'])
def obter_paginas_renderizadas():
    """
    Endpoint para obter todas as páginas renderizadas com metadados.
    Recebe PDF em Base64 e retorna páginas renderizadas com dimensões e DPI.
    """
    dados_json = request.get_json()
    
    if not dados_json or 'base64_data' not in dados_json or 'nome_arquivo' not in dados_json:
        return jsonify({
            "status": "erro",
            "message": "Payload JSON inválido ou incompleto."
        }), 400
    
    base64String = dados_json['base64_data']
    nome_arquivo = dados_json['nome_arquivo']
    
    try:
        dados_binarios = base64.b64decode(base64String)
        resultado = extrair_pagina_renderizada(dados_binarios, nome_arquivo, DPI_RENDERIZACAO)
        
        return jsonify({
            "status": "sucesso",
            "value": resultado
        })
    
    except Exception as e:
        print(f'Erro ao obter páginas renderizadas: {e}')
        return jsonify({
            "status": "erro",
            "message": f"Erro interno: {e}"
        }), 500


@app.route('/extrair-imagens-automaticas/', methods=['POST'])
def extrair_imagens_automaticas():
    """
    Endpoint para extrair imagens automaticamente do PDF usando extrair_imgPDFKV.
    """
    dados_json = request.get_json()
    
    if not dados_json or 'base64_data' not in dados_json or 'nome_arquivo' not in dados_json:
        return jsonify({
            "status": "erro",
            "message": "Payload JSON inválido. Esperado: base64_data, nome_arquivo"
        }), 400
    
    base64String = dados_json['base64_data']
    nome_arquivo = dados_json['nome_arquivo']
    
    try:
        dados_binarios = base64.b64decode(base64String)
        resultado = extrair_imgPDFKV(dados_binarios, nome_arquivo)
        
        if resultado['status'] == 'sucesso':
            # Converter estrutura para formato compatível com o frontend
            imagens_extraidas = []
            for page_key, imagens in resultado['imagens_encontradas'].items():
                for img in imagens:
                    imagens_extraidas.append({
                        "status": "sucesso",
                        "nome": img['nome'],
                        "extensao": img['extensao'],
                        "tamanho_bytes": img['arquivo_bytes'],
                        "base64_data": img['base64_data'],
                        "page_index": img['page_index'],
                        "page_number": img['page_number']
                    })
            
            return jsonify({
                "status": "sucesso",
                "value": {
                    "total_imagens": resultado['total_imagens'],
                    "imagens_extraidas": imagens_extraidas
                }
            })
        else:
            return jsonify(resultado), 400
    
    except Exception as e:
        print(f'Erro ao extrair imagens automáticas: {e}')
        return jsonify({
            "status": "erro",
            "message": f"Erro interno: {e}"
        }), 500


@app.route('/extrair-regioes-python/', methods=['POST'])
def extrair_regioes_python():
    """
    Endpoint para extrair múltiplas regiões específicas do PDF.
    Recebe array de seleções com coordenadas e retorna imagens extraídas.
    """
    dados_json = request.get_json()
    
    if not dados_json or 'base64_data' not in dados_json or 'nome_arquivo' not in dados_json or 'selecoes' not in dados_json:
        return jsonify({
            "status": "erro",
            "message": "Payload JSON inválido. Esperado: base64_data, nome_arquivo, selecoes"
        }), 400
    
    base64String = dados_json['base64_data']
    nome_arquivo = dados_json['nome_arquivo']
    selecoes = dados_json['selecoes']
    
    if not isinstance(selecoes, list) or len(selecoes) == 0:
        return jsonify({
            "status": "erro",
            "message": "Lista de seleções vazia ou inválida."
        }), 400
    
    try:
        dados_binarios = base64.b64decode(base64String)
        imagens_extraidas = []
        
        for idx, selecao in enumerate(selecoes):
            # Validar estrutura da seleção
            if not all(key in selecao for key in ['pageIndex', 'x', 'y', 'width', 'height']):
                imagens_extraidas.append({
                    "status": "erro",
                    "indice": idx,
                    "message": "Seleção incompleta. Esperado: pageIndex, x, y, width, height"
                })
                continue
            
            page_index = selecao['pageIndex']
            x_renderizado = float(selecao['x'])
            y_renderizado = float(selecao['y'])
            width_renderizado = float(selecao['width'])
            height_renderizado = float(selecao['height'])
            
            # Converter coordenadas da renderização para coordenadas do PDF
            x_pdf, y_pdf, width_pdf, height_pdf = converter_coordenadas_para_pdf(
                x_renderizado, y_renderizado, width_renderizado, height_renderizado
            )
            
            # Extrair região
            resultado = extrair_regiao_especifica(
                dados_binarios, nome_arquivo, page_index,
                x_pdf, y_pdf, width_pdf, height_pdf
            )
            
            resultado['indice_selecao'] = idx
            resultado['page_index'] = page_index
            resultado['page_number'] = page_index + 1  # Número da página (1-based)
            imagens_extraidas.append(resultado)
        
        return jsonify({
            "status": "sucesso",
            "total_selecoes": len(selecoes),
            "imagens_extraidas": imagens_extraidas
        })
    
    except Exception as e:
        print(f'Erro ao extrair regiões: {e}')
        return jsonify({
            "status": "erro",
            "message": f"Erro interno: {e}"
        }), 500
    
if __name__ == '__main__':
    print('Servidor Python rodando corretamente na porta 8000!')
    app.run(debug=True, port=8000)
