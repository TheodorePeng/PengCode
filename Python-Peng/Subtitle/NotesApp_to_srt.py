import re

def convert_to_standard_srt(input_file_path, output_file_path):
    with open(input_file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # 正则表达式匹配时间戳和文本
    time_pattern = re.compile(r"\[\d+:\d+:\d+\]")
    subtitles = []
    start_times = []

    # 提取时间戳和字幕文本
    for line in lines:
        timestamp_match = time_pattern.match(line)
        if timestamp_match:
            start_time = timestamp_match.group(0).strip('[]')
            # 转换时间格式
            start_time = re.sub(r"(\d+):(\d+):(\d+)", r"\1:\2:\3,000", start_time)
            start_times.append(start_time)
            text = line[timestamp_match.end():].strip()
            if text:
                subtitles.append(text)

    # 创建SRT内容
    srt_content = []
    for i in range(len(subtitles)):
        end_time = start_times[i+1] if i+1 < len(start_times) else increase_time(start_times[i], 5)  # 默认+5秒
        srt_content.append(f"{i+1}")
        srt_content.append(f"{start_times[i]} --> {end_time}")
        srt_content.append(subtitles[i])
        srt_content.append("")  # 空行

    # 写入到输出文件
    with open(output_file_path, 'w', encoding='utf-8') as file:
        file.write("\n".join(srt_content))

def increase_time(time_str, seconds_to_add):
    # 时间格式："HH:MM:SS,SSS"
    hours, minutes, rest = time_str.split(':')
    seconds, milliseconds = rest.split(',')
    total_seconds = int(hours) * 3600 + int(minutes) * 60 + int(seconds) + seconds_to_add
    new_hours = total_seconds // 3600
    new_minutes = (total_seconds % 3600) // 60
    new_seconds = total_seconds % 60
    return f"{new_hours:02}:{new_minutes:02}:{new_seconds:02},000"

# 使用例子
input_file = '/Users/peng/Desktop/123.txt'  # 只有这处自定义设置：修改为您的输入文件路径
output_file = input_file[:-3] + 'srt'  # 输出文件路径与输入文件路径相同，只是后缀不同
convert_to_standard_srt(input_file, output_file)


# 以上只有1处自定义设置，i.e. 输入文件位置，输出文件设置为和与输入文件同文件夹