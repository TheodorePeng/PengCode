import edge_tts
import asyncio
import os
from datetime import datetime
import pdfplumber

async def main():
    # PDF 文件路径
    pdf_path = "/Users/peng/Downloads/大鹏金翅明王-因为贱-所以生活艰辛!说出真相-底层会更绝望.pdf"

    # 打印文件路径
    print(f"你输入的PDF文件路径是：{pdf_path}")
    
    # 检查文件是否存在
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF文件不存在：{pdf_path}")
    
    # 使用 pdfplumber 提取文本
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:  # 检查是否成功提取文本
                text += extracted_text

    # 检查是否成功提取到文本
    if not text.strip():
        raise ValueError("PDF文件中没有可提取的文本")

    # 获取当前时间，生成文件名
    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # 自定义保存路径，使用 os.path.expanduser 来处理 ~ 符号
    save_directory = os.path.expanduser("~/Desktop/")

    # 检查路径是否存在，如果不存在则中断程序并提示
    if not os.path.exists(save_directory):
        raise FileNotFoundError(f"路径不存在：{save_directory}")

    # 文件路径和名称，使用当前时间作为文件名
    file_name = f"output_{current_time}.mp3"
    file_path = os.path.join(save_directory, file_name)

    # 使用 HsiaoChen 作为发音人
    communicate = edge_tts.Communicate(text, voice="zh-TW-HsiaoChenNeural", rate="+20%", volume="+10%")
    await communicate.save(file_path)

    print(f"文件已保存到：{file_path}")

# 运行异步函数
asyncio.run(main())
