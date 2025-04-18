import os
import re

def convert_txt_to_srt(txt_file_path):
    # 读取文本文件内容
    with open(txt_file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # 准备存储srt文件内容的列表
    srt_content = []
    
    # 序号计数器
    counter = 1

    # 正则表达式匹配时间戳
    timestamp_pattern = re.compile(r'\[(\d+:\d+\.\d+)\s*->\s*(\d+:\d+\.\d+)\]')
    
    # 处理每行内容
    for line in lines:
        # 移除首尾空白字符
        line = line.strip()
        
        # 跳过空行
        if not line:
            continue
        
        # 查找时间戳
        match = timestamp_pattern.search(line)
        if match:
            start_time = match.group(1).replace('.', ',')
            end_time = match.group(2).replace('.', ',')
            text = line[match.end():].strip()  # 获取时间戳后的文本
            
            # 生成srt格式内容
            srt_content.append(f"{counter}")
            srt_content.append(f"00:{start_time} --> 00:{end_time}")
            srt_content.append(text)
            srt_content.append("")  # 空行分隔
            
            counter += 1

    # 获取srt文件路径
    srt_file_path = os.path.splitext(txt_file_path)[0] + '.srt'
    
    # 写入srt文件
    with open(srt_file_path, 'w', encoding='utf-8') as file:
        file.write('\n'.join(srt_content))
    
    print(f"转换完成: {srt_file_path}")

# 示例调用
file_paths = [
    '/Users/peng/Desktop/Untitled.txt',  # 这里替换为你的第一个txt文件路径
    #'input2.txt',  # 这里替换为你的第二个txt文件路径
    # 可以继续添加更多文件路径
]

for file_path in file_paths:
    convert_txt_to_srt(file_path)


# https://huggingface.co/spaces/sanchit-gandhi/whisper-jax 在线识别YouTube字幕是非标准的字幕格式，此代码将识别字幕结果保存到txt文件中，然后将该txt文件路径转换为同路径下的srt文件