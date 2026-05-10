#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成时光印记试用指引PDF
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 颜色定义
COLOR_ORANGE = HexColor('#FF8C42')
COLOR_BG = HexColor('#FDF5E6')
COLOR_TEXT = HexColor('#333333')
COLOR_RED = HexColor('#FF4444')
COLOR_GREEN = HexColor('#2F855A')
COLOR_LIGHT_RED = HexColor('#FFF5F5')
COLOR_LIGHT_GREEN = HexColor('#F0FFF4')

# 注册中文字体
def register_fonts():
    """注册中文字体"""
    font_paths = [
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                if 'wqy-microhei' in font_path:
                    pdfmetrics.registerFont(TTFont('ChineseFont', font_path))
                    print(f"已注册字体: WenQuanYi Micro Hei")
                    return True
                elif 'wqy-zenhei' in font_path:
                    pdfmetrics.registerFont(TTFont('ChineseFont', font_path))
                    print(f"已注册字体: WenQuanYi Zen Hei")
                    return True
                elif 'NotoSansCJK' in font_path:
                    pdfmetrics.registerFont(TTFont('ChineseFont', font_path))
                    print(f"已注册字体: Noto Sans CJK")
                    return True
            except Exception as e:
                print(f"注册字体失败 {font_path}: {e}")
                continue
    
    print("警告: 未找到可用的中文字体，使用Helvetica")
    return False

register_fonts()

# 创建样式
def create_styles():
    styles = getSampleStyleSheet()
    
    # 标题样式
    styles.add(ParagraphStyle(
        name='MyTitlePage',
        fontName='ChineseFont',
        fontSize=28,
        leading=36,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=white
    ))
    
    styles.add(ParagraphStyle(
        name='MyTitleSub',
        fontName='ChineseFont',
        fontSize=16,
        leading=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=white
    ))
    
    # 步骤标题
    styles.add(ParagraphStyle(
        name='MyStepTitle',
        fontName='ChineseFont',
        fontSize=20,
        leading=28,
        spaceAfter=20,
        textColor=COLOR_ORANGE
    ))
    
    # 正文
    styles.add(ParagraphStyle(
        name='MyBodyText',
        fontName='ChineseFont',
        fontSize=12,
        leading=20,
        spaceAfter=10,
        textColor=COLOR_TEXT
    ))
    
    # 小标题
    styles.add(ParagraphStyle(
        name='MySubTitle',
        fontName='ChineseFont',
        fontSize=14,
        leading=20,
        spaceAfter=10,
        textColor=COLOR_TEXT
    ))
    
    # 重要提示
    styles.add(ParagraphStyle(
        name='MyImportantText',
        fontName='ChineseFont',
        fontSize=12,
        leading=20,
        spaceAfter=8,
        textColor=COLOR_RED
    ))
    
    # 提示框
    styles.add(ParagraphStyle(
        name='MyTipText',
        fontName='ChineseFont',
        fontSize=12,
        leading=20,
        spaceAfter=8,
        textColor=COLOR_GREEN
    ))
    
    # 功能卡片标题
    styles.add(ParagraphStyle(
        name='MyFeatureTitle',
        fontName='ChineseFont',
        fontSize=14,
        leading=20,
        spaceAfter=8,
        textColor=COLOR_ORANGE
    ))
    
    # FAQ问题
    styles.add(ParagraphStyle(
        name='MyFAQQuestion',
        fontName='ChineseFont',
        fontSize=13,
        leading=20,
        spaceAfter=8,
        textColor=COLOR_ORANGE
    ))
    
    # FAQ答案
    styles.add(ParagraphStyle(
        name='MyFAQAnswer',
        fontName='ChineseFont',
        fontSize=12,
        leading=20,
        spaceAfter=8,
        textColor=HexColor('#555555')
    ))
    
    # 最后页
    styles.add(ParagraphStyle(
        name='MyFinalTitle',
        fontName='ChineseFont',
        fontSize=22,
        leading=30,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=COLOR_ORANGE
    ))
    
    return styles

styles = create_styles()

# 页面背景设置
def add_page_background(canvas, doc):
    """添加页面背景"""
    canvas.saveState()
    # 米白色背景
    canvas.setFillColor(COLOR_BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()

def add_title_background(canvas, doc):
    """标题页背景"""
    canvas.saveState()
    # 橙色渐变背景
    canvas.setFillColor(COLOR_ORANGE)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()

def add_final_background(canvas, doc):
    """最后页背景"""
    canvas.saveState()
    canvas.setFillColor(HexColor('#FFF8F0'))
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()

# 创建截图占位框
def create_screenshot_placeholder(text):
    data = [[Paragraph(text, ParagraphStyle(
        name='ScreenshotText',
        fontName='ChineseFont',
        fontSize=12,
        textColor=HexColor('#999999'),
        alignment=TA_CENTER
    ))]]
    t = Table(data, colWidths=[14*cm], rowHeights=[5*cm])
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#FAFAFA')),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
    ]))
    return t

# 创建重要提示框
def create_important_box(title, items):
    elements = []
    elements.append(Paragraph(title, styles['MyImportantText']))
    for item in items:
        elements.append(Paragraph(f"• {item}", styles['MyImportantText']))
    
    data = [[elements]]
    t = Table(data, colWidths=[14*cm])
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, HexColor('#FF6B6B')),
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_RED),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    return t

# 创建提示框
def create_tip_box(title, items):
    elements = []
    elements.append(Paragraph(title, styles['MyTipText']))
    for item in items:
        elements.append(Paragraph(f"• {item}", styles['MyTipText']))
    
    data = [[elements]]
    t = Table(data, colWidths=[14*cm])
    t.setStyle(TableStyle([
        ('LINEBEFORE', (0, 0), (-1, -1), 4, HexColor('#48BB78')),
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_GREEN),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    return t

# 创建功能卡片
def create_feature_card(icon, title, desc):
    elements = []
    elements.append(Paragraph(f"{icon} {title}", styles['MyFeatureTitle']))
    elements.append(Paragraph(desc, styles['MyBodyText']))
    
    data = [[elements]]
    t = Table(data, colWidths=[14*cm])
    t.setStyle(TableStyle([
        ('LINEBEFORE', (0, 0), (-1, -1), 4, COLOR_ORANGE),
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#FFF8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    return t

# 创建FAQ项
def create_faq_item(question, answer):
    elements = []
    elements.append(Paragraph(question, styles['MyFAQQuestion']))
    elements.append(Paragraph(answer, styles['MyFAQAnswer']))
    
    data = [[elements]]
    t = Table(data, colWidths=[14*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#FAFAFA')),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    return t

# 主函数
def generate_pdf():
    output_path = "宝贝时光/运营/试用指引.pdf"
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    story = []
    
    # ========== 标题页 ==========
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("📖 「时光印记」试用指引", styles['MyTitlePage']))
    story.append(Paragraph("从0到1，10分钟上手，安全记录宝宝每一天", styles['MyTitleSub']))
    story.append(Spacer(1, 1*cm))
    
    # 链接框
    link_data = [[Paragraph("🔗 访问链接：请打开我发给你的 H5 链接", ParagraphStyle(
        name='LinkStyle', fontName='ChineseFont', fontSize=14, textColor=white, alignment=TA_CENTER,
        backColor=HexColor('#FFFFFF33'), borderPadding=15
    ))]]
    link_table = Table(link_data, colWidths=[13*cm])
    link_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#FFFFFF33')),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))
    story.append(link_table)
    
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("有问题随时问我，微信：XXX（2小时内必回）", ParagraphStyle(
        name='Contact', fontName='ChineseFont', fontSize=14, textColor=white, alignment=TA_CENTER
    )))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("—— 程序员爸爸", ParagraphStyle(
        name='Sign', fontName='ChineseFont', fontSize=14, textColor=white, alignment=TA_CENTER
    )))
    
    story.append(PageBreak())
    
    # ========== 第一步 ==========
    story.append(Paragraph("❶ 打开并初始化你的时光相册", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：浏览器打开H5链接，首页界面截图】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("<strong>操作说明：</strong>", styles['MySubTitle']))
    story.append(Paragraph("1. 在手机或电脑浏览器，打开我发给你的链接", styles['MyBodyText']))
    story.append(Paragraph("2. 首次打开会自动创建本地数据库（不需要注册账号！）", styles['MyBodyText']))
    story.append(Paragraph("3. 你看到的就是时光印记的主界面", styles['MyBodyText']))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_important_box(
        "⚠️ 重要说明",
        [
            "你的数据<strong>100%存在当前浏览器中</strong>，不上传任何服务器",
            "这意味着：清浏览器缓存 = 数据丢失！所以请定期导出备份",
            "建议使用 Chrome/Safari 等主流浏览器体验更好"
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== 第二步 ==========
    story.append(Paragraph("❷ 创建你家宝宝档案", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：宝宝档案创建界面】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("<strong>操作说明：</strong>", styles['MySubTitle']))
    story.append(Paragraph("1. 点击底部导航「我的」→ 「宝宝档案」", styles['MyBodyText']))
    story.append(Paragraph("2. 点击「+ 添加宝宝」", styles['MyBodyText']))
    story.append(Paragraph("3. 填写宝宝昵称、生日、性别", styles['MyBodyText']))
    story.append(Paragraph("4. 上传宝宝头像（可选）", styles['MyBodyText']))
    story.append(Paragraph("5. 点击「保存」", styles['MyBodyText']))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_tip_box(
        "💡 提示",
        [
            "支持添加多个宝宝（二胎/三胎家庭友好）",
            "宝宝生日会自动计算年龄，时光轴上会显示\"X岁X个月X天\""
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== 第三步 ==========
    story.append(Paragraph("❸ 上传第一条成长记录", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：发布记录界面，红色箭头标注「+」按钮位置】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("<strong>操作说明：</strong>", styles['MySubTitle']))
    story.append(Paragraph("1. 点击首页右下角「+」按钮", styles['MyBodyText']))
    story.append(Paragraph("2. 选择要上传的照片或视频（最多9张）", styles['MyBodyText']))
    story.append(Paragraph("3. 写一段记录文字（比如\"第一次抬头\"\"会叫妈妈了\"）", styles['MyBodyText']))
    story.append(Paragraph("4. 选择心情标签😊、天气☁️、地点📍", styles['MyBodyText']))
    story.append(Paragraph("5. 点击「发布」", styles['MyBodyText']))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("🎉 恭喜！你已经完成了第一条时光记录！", ParagraphStyle(
        name='Congrats', fontName='ChineseFont', fontSize=14, textColor=COLOR_ORANGE,
        alignment=TA_CENTER
    )))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_tip_box(
        "💡 小技巧",
        [
            "照片会自动按拍摄时间排序",
            "可以点击「AI帮我写」，让AI辅助生成记录文案"
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== 第四步 ==========
    story.append(Paragraph("❹ 标记宝宝的里程碑", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：里程碑标签选择界面】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("<strong>操作说明：</strong>", styles['MySubTitle']))
    story.append(Paragraph("1. 发布记录时，点击「标签」", styles['MyBodyText']))
    story.append(Paragraph("2. 选择对应的里程碑标签（如「第一次微笑」「第一次翻身」「会走路了」）", styles['MyBodyText']))
    story.append(Paragraph("3. 也可以自定义新的里程碑标签", styles['MyBodyText']))
    story.append(Paragraph("4. 在「统计」页面可以看到所有达成的里程碑时间线", styles['MyBodyText']))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_tip_box(
        "⭐ 为什么重要",
        [
            "宝宝的每个第一次都值得纪念",
            "多年后回头看，这会是最珍贵的回忆"
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== 第五步 ==========
    story.append(Paragraph("❺ 体验6大独家功能（泪点预警）", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：功能入口网格界面】"))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("这是我们和某光小屋、某宝宝最大的区别——", styles['MyBodyText']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_feature_card("🔮", "月龄神预言", "根据宝宝出生月份，生成专属性格预测和发展建议，每个月更新一次，像拆盲盒一样期待"))
    story.append(Spacer(1, 0.3*cm))
    story.append(create_feature_card("🎁", "时光盲盒", "随机抽取过去某一天的记录，每次打开都是惊喜，重温被遗忘的美好瞬间"))
    story.append(Spacer(1, 0.3*cm))
    story.append(create_feature_card("📈", "心情曲线", "统计宝宝的情绪变化趋势，发现宝宝开心/哭闹的规律，科学育儿"))
    story.append(Spacer(1, 0.3*cm))
    story.append(create_feature_card("🎬", "名场面集锦", "AI自动识别并提取成长中的高光时刻，一键生成宝宝的\"名场面\"合集"))
    story.append(Spacer(1, 0.3*cm))
    story.append(create_feature_card("✉️", "来自宝宝的信封", "AI以宝宝的口吻，写一封信给爸妈，很多妈妈看完直接哭了"))
    story.append(Spacer(1, 0.3*cm))
    story.append(create_feature_card("💌", "给宝宝的信", "你写给未来宝宝的信，可以设定未来某一天打开，像时光邮差一样浪漫"))
    
    story.append(PageBreak())
    
    # ========== 第六步 ==========
    story.append(Paragraph("❻ 生成宝宝成长报告", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：成长档案报告界面】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("<strong>操作说明：</strong>", styles['MySubTitle']))
    story.append(Paragraph("1. 点击底部导航「统计」", styles['MyBodyText']))
    story.append(Paragraph("2. 选择时间范围（近1月/近3月/近1年/全部）", styles['MyBodyText']))
    story.append(Paragraph("3. 系统自动生成「宝宝成长档案」", styles['MyBodyText']))
    story.append(Paragraph("4. 包含：记录数量统计、里程碑达成、心情分布、时光寄语等", styles['MyBodyText']))
    story.append(Paragraph("5. 可以一键生成分享卡片发朋友圈", styles['MyBodyText']))
    
    story.append(PageBreak())
    
    # ========== 第七步 ==========
    story.append(Paragraph("❼ 数据备份（非常重要！）", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：导出备份界面】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("<strong>操作说明：</strong>", styles['MySubTitle']))
    story.append(Paragraph("1. 点击「我的」→「数据管理」", styles['MyBodyText']))
    story.append(Paragraph("2. 点击「导出全部数据」", styles['MyBodyText']))
    story.append(Paragraph("3. 浏览器会自动下载一个 JSON 文件（包含所有照片，base64编码）", styles['MyBodyText']))
    story.append(Paragraph("4. 把这个文件存到你家电脑、NAS或移动硬盘上", styles['MyBodyText']))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_important_box(
        "⚠️ 必看提醒",
        [
            "你的数据只存在当前浏览器里",
            "如果清了浏览器缓存、换了浏览器、换了手机，数据就没了",
            "<strong>建议每周导出一次备份</strong>，这是你能拿到完整数据的唯一方式",
            "付费后我会教你怎么部署到自己家NAS/电脑上，实现真正的\"永久本地存储\""
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== 第八步 ==========
    story.append(Paragraph("❽ 家人怎么一起看？", styles['MyStepTitle']))
    story.append(create_screenshot_placeholder("【截图占位：账号设置界面】"))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("当前方案（纯前端）：", styles['MySubTitle']))
    story.append(Paragraph("1. 导出你的完整数据包（见第七步）", styles['MyBodyText']))
    story.append(Paragraph("2. 把JSON文件发给家人", styles['MyBodyText']))
    story.append(Paragraph("3. 家人在自己手机上打开H5链接", styles['MyBodyText']))
    story.append(Paragraph("4. 点击「我的」→「数据管理」→「导入数据」", styles['MyBodyText']))
    story.append(Paragraph("5. 家人就能看到宝宝的所有记录了", styles['MyBodyText']))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_tip_box(
        "💡 付费高阶版方案",
        [
            "部署到你家NAS后，全家共用一个本地地址访问",
            "多人同时记录，数据实时同步",
            "支持9种家庭角色（妈妈/爸爸/爷爷/奶奶/外公/外婆等）"
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== 第九步 ==========
    story.append(Paragraph("❾ 15天后怎么办？", styles['MyStepTitle']))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("试用期结束后你有两个选择：", styles['MyBodyText']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_feature_card("选项A", "不满意，不付费", 
        "告诉我\"不续了\"<br/><br/>"
        "我会帮你确认「如何完整导出所有数据」的步骤<br/><br/>"
        "你的照片和视频全部归你，我们不留任何副本<br/><br/>"
        "0元，无任何收费<br/><br/>"
        "<em>（其实试用没有时间限制，你愿意用多久就用多久）</em>"
    ))
    
    story.append(Spacer(1, 0.5*cm))
    
    # 价格表格
    price_data = [
        [Paragraph("版本", ParagraphStyle(name='TableHeader', fontName='ChineseFont', fontSize=12, textColor=white, alignment=TA_CENTER)),
         Paragraph("价格", ParagraphStyle(name='TableHeader', fontName='ChineseFont', fontSize=12, textColor=white, alignment=TA_CENTER)),
         Paragraph("包含", ParagraphStyle(name='TableHeader', fontName='ChineseFont', fontSize=12, textColor=white, alignment=TA_CENTER))],
        [Paragraph("基础版", styles['MyBodyText']),
         Paragraph("¥299", styles['MyBodyText']),
         Paragraph("全部基础功能 + 永久使用 + 永久升级", styles['MyBodyText'])],
        [Paragraph("高阶版", styles['MyBodyText']),
         Paragraph("¥599", styles['MyBodyText']),
         Paragraph("全部功能 + 本地部署到NAS/电脑 + 1对1远程协助 + DIY高定模板包", styles['MyBodyText'])]
    ]
    
    price_table = Table(price_data, colWidths=[3*cm, 3*cm, 8*cm])
    price_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_ORANGE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#FFE4CC')),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#FFFBF5')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    story.append(Paragraph("选项B：满意，付费升级", styles['MySubTitle']))
    story.append(price_table)
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("💳 付费方式：微信转账，当天开通部署指导", ParagraphStyle(
        name='Payment', fontName='ChineseFont', fontSize=12, textColor=COLOR_TEXT, alignment=TA_CENTER
    )))
    
    story.append(Spacer(1, 0.5*cm))
    story.append(create_tip_box(
        "🎁 首发福利（仅限前15名试用用户）",
        [
            "高阶版¥599，送价值¥299的DIY高定模板包",
            "1对1远程协助部署到你家NAS/电脑",
            "未来所有新功能永久免费升级"
        ]
    ))
    
    story.append(PageBreak())
    
    # ========== FAQ 1 ==========
    story.append(Paragraph("❓ 常见问题 FAQ", styles['MyStepTitle']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q1：我的照片存在哪里？安全吗？",
        "A：100%存在你当前使用的浏览器本地数据库（IndexedDB）中。不上传任何服务器，不经过任何第三方。<br/><br/>"
        "物理上，数据就在你手机或电脑的硬盘里。我们和任何第三方都拿不到。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q2：我技术不好，能搞定吗？",
        "A：完全不用技术。打开链接就能用，不需要安装任何软件。<br/><br/>"
        "付费后我会提供「一键部署工具」+ 1对1远程协助，10分钟搞定。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q3：如果我换手机了，数据怎么办？",
        "A：在旧手机上导出完整数据包（JSON），发到新手机上导入即可。<br/><br/>"
        "建议定期导出备份，这是最重要的事。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q4：清浏览器缓存会丢数据吗？",
        "A：会！这是纯前端应用最大的特点。<br/><br/>"
        "所以<strong>一定要定期导出备份</strong>。建议每周导出一次存到电脑/NAS。"
    ))
    
    story.append(PageBreak())
    
    # ========== FAQ 2 ==========
    story.append(Paragraph("❓ 常见问题 FAQ（续）", styles['MyStepTitle']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q5：能导出照片吗？",
        "A：可以。任何时候都能一键导出全部照片和视频，不额外收费。<br/><br/>"
        "导出的是base64编码的完整数据，包含所有照片和元数据。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q6：如果你们不做了怎么办？",
        "A：这就是本地部署的最大好处——付费后部署到你自己的NAS/电脑上，我们公司倒不倒闭不影响你使用。<br/><br/>"
        "而且部分核心代码已开源，技术型用户甚至可以自己维护。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q7：支持多宝宝吗？",
        "A：支持，不限数量，二胎三胎家庭友好。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q8：家庭共享怎么弄？",
        "A：试用版通过导出/导入数据包共享。<br/><br/>"
        "付费高阶版部署到NAS后，全家可以同时在线记录，数据实时同步。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q9：AI功能会上传我的照片吗？",
        "A：不会。所有AI运算（智能分类、写文案等）都在你的浏览器本地完成，照片不上传。<br/><br/>"
        "（注：如果用了大模型API写文案，只有文字会请求，照片不上传）"
    ))
    
    story.append(PageBreak())
    
    # ========== FAQ 3 ==========
    story.append(Paragraph("❓ 常见问题 FAQ（续）", styles['MyStepTitle']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q10：为什么某光小屋这些不做本地部署？",
        "A：因为他们的商业模式就是靠你的数据赚钱——卖广告、做用户画像、数据变现。<br/><br/>"
        "如果数据都在你家，他们赚什么钱？"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q11：一次付费真的永久使用吗？会不会后面涨价？",
        "A：真的。一次付费，所有已有的功能永久使用，未来的功能升级也免费。<br/><br/>"
        "我做这个产品是给自己宝宝用的，顺便分享给有缘人，不是为了赚快钱。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q12：支持哪些浏览器？",
        "A：推荐 Chrome、Safari、Edge。不建议用微信内置浏览器（兼容性问题）。<br/><br/>"
        "手机上建议用系统自带浏览器打开。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q13：照片有大小限制吗？",
        "A：单张照片建议控制在10MB以内（手机拍照一般没问题）。<br/><br/>"
        "总存储容量取决于你浏览器的限制，一般是500MB-5GB不等。<br/><br/>"
        "部署到NAS后就没有容量限制了。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q14：可以离线使用吗？",
        "A：可以！数据在本地，没网也能看记录、写日记。<br/><br/>"
        "只有需要AI写文案的时候才需要联网。"
    ))
    
    story.append(PageBreak())
    
    # ========== FAQ 4 ==========
    story.append(Paragraph("❓ 常见问题 FAQ（续）", styles['MyStepTitle']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q15：为什么要付费？免费不好吗？",
        "A：免费的才是最贵的——你在用你的数据付费。<br/><br/>"
        "我收一次钱，给你一辈子的服务，不看广告，不卖数据，不绑架用户。<br/><br/>"
        "这才是真正的用户和产品的双赢。"
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(create_faq_item(
        "Q16：和时光小屋/亲宝宝/宝宝树有什么本质区别？",
        "A：一句话总结——他们的数据在他们服务器上，你的数据只属于你。<br/><br/>"
        "另外我们有6大独家功能（月龄神预言、时光盲盒、来自宝宝的信封等），是他们永远做不出来的——因为他们没有数据主权，不敢也不能拿用户最私密的情感数据去喂AI。"
    ))
    
    story.append(PageBreak())
    
    # ========== 最后页 ==========
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("有任何问题，随时微信我", styles['MyFinalTitle']))
    story.append(Paragraph("（2小时内必回）", ParagraphStyle(
        name='FinalSub', fontName='ChineseFont', fontSize=16, textColor=HexColor('#666666'), alignment=TA_CENTER
    )))
    
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("❤️", ParagraphStyle(
        name='Heart', fontName='ChineseFont', fontSize=60, alignment=TA_CENTER
    )))
    
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("期待为你的宝宝留下最安心的成长记忆", ParagraphStyle(
        name='FinalMessage', fontName='ChineseFont', fontSize=18, textColor=COLOR_ORANGE, alignment=TA_CENTER
    )))
    
    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph("—— 程序员爸爸", ParagraphStyle(
        name='FinalSign', fontName='ChineseFont', fontSize=14, textColor=HexColor('#888888'), alignment=TA_CENTER
    )))
    
    # 构建PDF
    doc.build(story, onFirstPage=add_title_background, onLaterPages=add_page_background)
    print(f"PDF已生成: {output_path}")

if __name__ == "__main__":
    generate_pdf()
