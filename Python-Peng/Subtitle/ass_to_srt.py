import pysubs2
import os

def convert_ass_to_srt(folder_path):
    # 遍历指定文件夹
    for filename in os.listdir(folder_path):
        if filename.endswith(".ass"):
            file_path = os.path.join(folder_path, filename)
            srt_path = os.path.join(folder_path, filename[:-4] + ".srt")
            
            # 加载.ass文件
            subs = pysubs2.load(file_path)
            
            # 保存为.srt格式
            subs.save(srt_path, encoding="utf-8", format_='srt')
            print(f"Converted {file_path} to {srt_path}")

# 替换下面的路径为你的文件夹路径
folder_path = '/Users/peng/Downloads/[zmk.pw]辐射.第1季.全8集[8.7]Fallout.S01.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb_OT精校'
convert_ass_to_srt(folder_path)

# 以上只有1处自定义设置
