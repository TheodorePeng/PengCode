import os
from PIL import Image
from reportlab.pdfgen import canvas
from datetime import datetime

# 下载文件夹路径
downloads_folder = "/Users/peng/Downloads"

# 查找所有包含"Untitled"的图片文件
image_paths = [os.path.join(downloads_folder, f) for f in os.listdir(downloads_folder) if f.startswith("Untitled") and f.endswith(".png")]

# 按文件名中的数字排序
def get_sort_key(path):
    filename = os.path.basename(path)
    name, ext = os.path.splitext(filename)
    if name == "Untitled":
        return -1
    else:
        try:
            return int(name.split(' ')[-1].strip('()'))
        except ValueError:
            return float('inf')  # 不匹配的文件名放在最后

image_paths.sort(key=get_sort_key)

# 获取当前时间
current_time = datetime.now().strftime("%Y%m%d_%H%M%S")

# 生成PDF
output_pdf_path = os.path.join(downloads_folder, f"merged_images_{current_time}.pdf")
c = canvas.Canvas(output_pdf_path)

for image_path in image_paths:
    img = Image.open(image_path)
    img_width, img_height = img.size

    # 设置页面大小与图片大小相同
    c.setPageSize((img_width, img_height))

    # 添加图片作为页面
    c.drawImage(image_path, 0, 0, img_width, img_height)
    c.showPage()

c.save()
print(f"PDF saved to {output_pdf_path}")

# 对于snipo的截图，使用tempermonkey脚本下载notion页面全部图片后，在downloads文件夹中会形成多个Untitled*.png文件，运行本脚本即可生成PDF下载。查找"Untitled"开头的图片文件，并按文件名中的数字排序，然后运行本脚本即可生成PDF下载