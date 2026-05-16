/**
 * 虚拟时光专题数据
 * 预置5个AI生成内容专题
 */

export const virtualTimeTopics = [
  {
    id: 'kindergarten',
    title: '幼儿园宝宝',
    description: 'AI想象宝宝在幼儿园的快乐时光，画画、游戏、交朋友',
    coverEmoji: '🎨',
    coverGradient: 'from-primary-400 to-amber-400',
    coverIcon: '🏫',
    items: [
      {
        id: 1,
        type: 'image',
        title: '第一次画画课',
        description: '小画家拿起画笔，创作了人生第一幅作品——一个彩色的太阳和一座蓝色的小房子。',
        imagePrompt: 'A cute toddler in kindergarten drawing colorful pictures at a small wooden table, bright classroom with sunlight, crayons scattered around, joyful expression, soft pastel colors, children\'s art hanging on walls',
        tags: ['画画', '创造力'],
        date: '未来某天'
      },
      {
        id: 2,
        type: 'image',
        title: '午睡时间',
        description: '乖乖躺在床上，抱着小熊玩偶，做着甜甜的美梦~',
        imagePrompt: 'A cute sleeping toddler in kindergarten nap time, small colorful bed, hugging a teddy bear, peaceful sleeping face, soft afternoon sunlight through windows, cozy classroom setting',
        tags: ['午睡', '可爱'],
        date: '未来某天'
      },
      {
        id: 3,
        type: 'text',
        title: '交到新朋友',
        content: '今天在幼儿园认识了一个新朋友，我们一起搭积木，还约好明天一起玩沙沙！',
        emoji: '👫',
        tags: ['社交', '友谊'],
        date: '未来某天'
      },
      {
        id: 4,
        type: 'image',
        title: '户外活动',
        description: '在幼儿园的小操场上奔跑、荡秋千、玩滑梯，欢乐的笑声充满整个午后~',
        imagePrompt: 'A happy toddler playing on playground equipment in kindergarten, swings and slides, bright sunny day, green grass, children laughing, colorful playground, cheerful atmosphere',
        tags: ['运动', '快乐'],
        date: '未来某天'
      },
    ]
  },
  {
    id: 'middle_school',
    title: '中学的宝宝',
    description: '少年初长成，学习、运动、青春洋溢的校园时光',
    coverEmoji: '📚',
    coverGradient: 'from-blue-400 to-purple-400',
    coverIcon: '🏃',
    items: [
      {
        id: 1,
        type: 'image',
        title: '运动会上',
        description: '短跑冲刺的瞬间，阳光下挥洒汗水，为了班级荣誉奋力拼搏！',
        imagePrompt: 'A teenage student running in a school sports day race, wearing sports uniform, determined expression, bright stadium with cheering students, golden sunlight, dynamic motion blur,青春活力',
        tags: ['运动', '拼搏'],
        date: '未来某天'
      },
      {
        id: 2,
        type: 'text',
        title: '班级合照',
        content: '和同学们一起拍班级合照，大家笑得都很开心。这是青春最美好的回忆~',
        emoji: '📸',
        tags: ['校园', '友谊'],
        date: '未来某天'
      },
      {
        id: 3,
        type: 'image',
        title: '图书馆时光',
        description: '安静地坐在图书馆里看书，阳光透过窗户洒在书页上，享受阅读的乐趣。',
        imagePrompt: 'A teenage student reading a book in school library, warm sunlight through tall windows, rows of books behind, peaceful focused expression, cozy reading nook, intellectual atmosphere',
        tags: ['学习', '阅读'],
        date: '未来某天'
      },
      {
        id: 4,
        type: 'image',
        title: '音乐课',
        description: '抱着吉他弹唱，校园歌手大赛的舞台上，展现自己的才华~',
        imagePrompt: 'A teenage student playing guitar on school stage, spotlight lighting, school auditorium background, confident performing expression, musical notes floating in air, passionate performance',
        tags: ['音乐', '才华'],
        date: '未来某天'
      },
    ]
  },
  {
    id: 'wedding',
    title: '结婚的宝宝',
    description: '长大成人的喜悦，人生新篇章的幸福起点',
    coverEmoji: '💒',
    coverGradient: 'from-rose-400 to-pink-300',
    coverIcon: '💕',
    items: [
      {
        id: 1,
        type: 'image',
        title: '婚礼当天',
        description: '穿着漂亮的婚纱/礼服，在亲朋好友的祝福中，开启人生的新篇章。',
        imagePrompt: 'Elegant wedding ceremony, bride in beautiful white dress, groom in suit, exchanging vows, romantic floral decorations, soft golden lighting, guests smiling in background, joyful tears, fairy tale atmosphere',
        tags: ['婚礼', '幸福'],
        date: '未来某天'
      },
      {
        id: 2,
        type: 'text',
        title: '感谢父母',
        content: '牵着爸爸妈妈的手，感谢你们一路的养育之恩。以后换我来照顾你们啦~ 💕',
        emoji: '👨‍👩‍👧',
        tags: ['感恩', '亲情'],
        date: '未来某天'
      },
      {
        id: 3,
        type: 'image',
        title: '蜜月旅行',
        description: '和心爱的人一起去旅行，看最美的风景，留下最甜蜜的回忆~',
        imagePrompt: 'Couple on romantic honeymoon, tropical beach sunset, holding hands, beautiful ocean view, palm trees, luxury resort background, romantic atmosphere, dreamy quality',
        tags: ['蜜月', '浪漫'],
        date: '未来某天'
      },
      {
        id: 4,
        type: 'text',
        title: '对未来的期许',
        content: '无论未来如何，我都会努力生活、认真爱人。感谢父母教会我善良和勇敢，我会让你们骄傲的！',
        emoji: '🌟',
        tags: ['成长', '期许'],
        date: '未来某天'
      },
    ]
  },
  {
    id: 'moments',
    title: '宝宝朋友圈',
    description: '模拟宝宝长大后的朋友圈动态，分享生活的点点滴滴',
    coverEmoji: '📱',
    coverGradient: 'from-green-400 to-teal-300',
    coverIcon: '🌟',
    items: [
      {
        id: 1,
        type: 'moment',
        title: '今天的早餐',
        content: '自己做的三明治，虽然卖相一般，但是很有成就感！🍳 #早餐打卡#',
        authorAvatar: '👶',
        authorName: '小天使',
        likes: 23,
        comments: 5,
        time: '刚刚',
        tags: ['生活', '美食'],
      },
      {
        id: 2,
        type: 'moment',
        title: '周末郊游',
        content: '和大自然来个亲密接触，山里的空气真的好清新啊~ 🌲 #周末愉快#',
        authorAvatar: '😊',
        authorName: '快乐星',
        images: ['🌄', '🌲', '🏞️'],
        likes: 45,
        comments: 8,
        time: '2小时前',
        tags: ['旅行', '放松'],
      },
      {
        id: 3,
        type: 'moment',
        title: '学习新技能',
        content: '终于学会骑自行车啦！摔了几跤但是很值得~ 🚴 #成长记录#',
        authorAvatar: '🌟',
        authorName: '追风少年',
        likes: 67,
        comments: 12,
        time: '昨天',
        tags: ['成长', '技能'],
      },
      {
        id: 4,
        type: 'moment',
        title: '小确幸',
        content: '今天收到了一份意外的礼物，开心~ 🎁',
        authorAvatar: '💝',
        authorName: '幸福宝',
        likes: 34,
        comments: 6,
        time: '3天前',
        tags: ['心情', '惊喜'],
      },
    ]
  },
  {
    id: 'tangshi',
    title: '宝宝背唐诗',
    description: '传承经典文化，从小培养文学素养，唐诗启蒙教育',
    coverEmoji: '📜',
    coverGradient: 'from-amber-400 to-yellow-300',
    coverIcon: '🏮',
    items: [
      {
        id: 1,
        type: 'poem',
        title: '静夜思',
        author: '李白',
        content: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。',
        translation: '明亮的月光洒在床前，好像地上泛起了一层霜。我禁不住抬起头来，看那天窗外空中的一轮明月，不由得低头沉思，想起远方的家乡。',
        imagePrompt: 'Ancient Chinese scholar child reading by moonlight through window, traditional Chinese bedroom, full moon visible outside, contemplative peaceful expression, ink wash painting style, soft silver lighting',
        tags: ['唐诗', '思乡'],
        difficulty: '简单',
      },
      {
        id: 2,
        type: 'poem',
        title: '咏鹅',
        author: '骆宾王',
        content: '鹅鹅鹅，曲项向天歌。\n白毛浮绿水，红掌拨清波。',
        translation: '鹅呀鹅呀鹅，弯着脖子朝着天空唱歌。雪白的羽毛漂浮在碧绿的水面上，红色的脚掌划着清清的水波。',
        imagePrompt: 'Cute white goose swimming in clear pond, green water plants, traditional Chinese garden pond, child watching with curiosity nearby, serene traditional Chinese landscape, watercolor style',
        tags: ['唐诗', '动物'],
        difficulty: '简单',
      },
      {
        id: 3,
        type: 'poem',
        title: '春晓',
        author: '孟浩然',
        content: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。',
        translation: '春天的夜晚睡得很香甜，不知不觉天就亮了；醒来时四处都可以听到鸟儿的啼叫声。想起昨夜风声雨声阵阵，不知有多少花儿被吹落了呢。',
        imagePrompt: 'Traditional Chinese spring morning scene, sleeping child waking up, birds singing outside window, cherry blossoms falling, soft morning light, peaceful bedroom with traditional furnishings, serene atmosphere',
        tags: ['唐诗', '春天'],
        difficulty: '简单',
      },
      {
        id: 4,
        type: 'poem',
        title: '悯农',
        author: '李绅',
        content: '锄禾日当午，汗滴禾下土。\n谁知盘中餐，粒粒皆辛苦。',
        translation: '农民在烈日当空的中午在田里锄地，汗水一滴一滴地落在禾苗下面的土地上。有谁知道那盘中的饭食，每一粒都包含着农民的辛苦。',
        imagePrompt: 'Hardworking Chinese farmer in golden wheat field under hot sun, dropping sweat, traditional farming tools, children watching thoughtfully from path, warm sunset lighting, countryside landscape, respectful atmosphere',
        tags: ['唐诗', '劳动'],
        difficulty: '中等',
      },
    ]
  }
];

export default virtualTimeTopics;
