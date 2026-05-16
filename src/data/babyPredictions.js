/**
 * 宝宝月龄神预言数据
 * 包含0-36个月每月龄的预言数据
 * 三种类型：behavior（行为）、speech（语言）、moment（名场面）
 */

// 0个月宝宝预言
const month0 = [
  { id: 'pred_0_1', monthAge: 0, type: 'behavior', content: '本周可能在睡梦中做出奇怪的表情，像个微表情表演艺术家', emoji: '😴' },
  { id: 'pred_0_2', monthAge: 0, type: 'speech', content: '即将发出第一声真正意义上的哭声，标志着语言生涯的开始', emoji: '👶' },
  { id: 'pred_0_3', monthAge: 0, type: 'moment', content: '即将解锁"吃手"技能，开始探索这个新奇的世界', emoji: '🤌' },
  { id: 'pred_0_4', monthAge: 0, type: 'behavior', content: '本周可能对光亮的地方产生浓厚兴趣，眼睛追着看', emoji: '👀' },
  { id: 'pred_0_5', monthAge: 0, type: 'moment', content: '即将第一次被自己的拳头吓到，表情十分困惑', emoji: '😮' },
];

// 1个月宝宝预言
const month1 = [
  { id: 'pred_1_1', monthAge: 1, type: 'behavior', content: '本周可能开始尝试抬头，虽然只能撑几秒钟', emoji: '🏋️' },
  { id: 'pred_1_2', monthAge: 1, type: 'speech', content: '即将发出"咕咕"声，这是最早的语音练习', emoji: '🗣️' },
  { id: 'pred_1_3', monthAge: 1, type: 'moment', content: '即将第一次对妈妈微笑，虽然可能只是肌肉抽搐', emoji: '😊' },
  { id: 'pred_1_4', monthAge: 1, type: 'behavior', content: '可能开始认识奶瓶，看到就兴奋挥手', emoji: '🍼' },
  { id: 'pred_1_5', monthAge: 1, type: 'moment', content: '即将解锁"抓住妈妈头发"技能，且不知松手', emoji: '💇' },
];

// 2个月宝宝预言
const month2 = [
  { id: 'pred_2_1', monthAge: 2, type: 'behavior', content: '本周可能开始认人，看到陌生人会皱眉头', emoji: '🤨' },
  { id: 'pred_2_2', monthAge: 2, type: 'speech', content: '即将开始咿咿呀呀地"说话"，仿佛在讨论人生', emoji: '🗣️' },
  { id: 'pred_2_3', monthAge: 2, type: 'moment', content: '可能第一次被自己的哭声吓到，突然安静', emoji: '😲' },
  { id: 'pred_2_4', monthAge: 2, type: 'behavior', content: '即将学会追视物品，眼神开始有神了', emoji: '👁️' },
  { id: 'pred_2_5', monthAge: 2, type: 'moment', content: '可能开始喜欢被竖着抱，可以看到更多世界', emoji: '🤱' },
  { id: 'pred_2_6', monthAge: 2, type: 'behavior', content: '即将解锁"吃拳头"技能，手指协调性初现', emoji: '✊' },
];

// 3个月宝宝预言
const month3 = [
  { id: 'pred_3_1', monthAge: 3, type: 'behavior', content: '本周可能开始流口水，像是打开了水龙头', emoji: '💧' },
  { id: 'pred_3_2', monthAge: 3, type: 'speech', content: '即将发出爽朗的笑声，这将是本周最治愈的时刻', emoji: '😂' },
  { id: 'pred_3_3', monthAge: 3, type: 'moment', content: '可能第一次抓住拨浪鼓，然后立刻扔掉', emoji: '🥁' },
  { id: 'pred_3_4', monthAge: 3, type: 'behavior', content: '即将开始认妈妈，妈妈一走开就开启警报模式', emoji: '🚨' },
  { id: 'pred_3_5', monthAge: 3, type: 'moment', content: '可能开始喜欢照镜子，对镜中人充满好奇', emoji: '🪞' },
  { id: 'pred_3_6', monthAge: 3, type: 'behavior', content: '即将学会拍水，可能在洗澡时拍得水花四溅', emoji: '💦' },
];

// 4个月宝宝预言
const month4 = [
  { id: 'pred_4_1', monthAge: 4, type: 'behavior', content: '本周可能对自己的脚产生浓厚兴趣，并试图塞进嘴里', emoji: '🦶' },
  { id: 'pred_4_2', monthAge: 4, type: 'speech', content: '即将开始尖叫，这是嗓门训练的第一阶段', emoji: '📢' },
  { id: 'pred_4_3', monthAge: 4, type: 'moment', content: '可能第一次翻身成功，然后一脸震惊地看着自己', emoji: '🤯' },
  { id: 'pred_4_4', monthAge: 4, type: 'behavior', content: '即将对遥控器产生浓厚兴趣，特别是按键', emoji: '📺' },
  { id: 'pred_4_5', monthAge: 4, type: 'moment', content: '可能开始认奶瓶，看到奶瓶就手舞足蹈', emoji: '🍼' },
  { id: 'pred_4_6', monthAge: 4, type: 'behavior', content: '即将学会抓住所有能抓到的东西，包括妈妈的首饰', emoji: '💎' },
  { id: 'pred_4_7', monthAge: 4, type: 'moment', content: '可能开始喜欢被竖抱，可以看到更高更远的世界', emoji: '🌍' },
];

// 5个月宝宝预言
const month5 = [
  { id: 'pred_5_1', monthAge: 5, type: 'behavior', content: '本周可能开始撕纸，这是毁灭性人格的初次展现', emoji: '📄' },
  { id: 'pred_5_2', monthAge: 5, type: 'speech', content: '即将发出"妈妈"的声音，虽然不知道含义', emoji: '👩' },
  { id: 'pred_5_3', monthAge: 5, type: 'moment', content: '可能第一次尝试爬行，但只是原地打转', emoji: '🌀' },
  { id: 'pred_5_4', monthAge: 5, type: 'behavior', content: '即将对所有食物产生强烈兴趣，伸手就要抓', emoji: '🍽️' },
  { id: 'pred_5_5', monthAge: 5, type: 'moment', content: '可能开始认生，看到陌生人会躲进妈妈怀里', emoji: '😰' },
  { id: 'pred_5_6', monthAge: 5, type: 'behavior', content: '即将解锁"咯咯笑"技能，这将是本周的快乐源泉', emoji: '😆' },
  { id: 'pred_5_7', monthAge: 5, type: 'speech', content: '可能开始用不同音调表达需求，像在学习语言', emoji: '🎵' },
];

// 6个月宝宝预言
const month6 = [
  { id: 'pred_6_1', monthAge: 6, type: 'behavior', content: '即将发出一个你完全听不懂但语气极其严肃的长篇演讲', emoji: '🎤' },
  { id: 'pred_6_2', monthAge: 6, type: 'speech', content: '可能开始叫"爸爸"或"妈妈"，并且要叫一整天', emoji: '👨' },
  { id: 'pred_6_3', monthAge: 6, type: 'moment', content: '即将解锁"坐起来"技能，从此可以用新角度看世界', emoji: '🪑' },
  { id: 'pred_6_4', monthAge: 6, type: 'behavior', content: '可能开始扔东西，捡起来再扔，乐此不疲', emoji: '🎾' },
  { id: 'pred_6_5', monthAge: 6, type: 'moment', content: '可能开始认辅食，吃到新食物表情精彩', emoji: '🥣' },
  { id: 'pred_6_6', monthAge: 6, type: 'behavior', content: '即将学会用吸管杯喝水，虽然可能喝得满脸都是', emoji: '🥤' },
  { id: 'pred_6_7', monthAge: 6, type: 'moment', content: '可能第一次拍手，虽然节奏完全随机', emoji: '👏' },
  { id: 'pred_6_8', monthAge: 6, type: 'behavior', content: '即将对镜子里的自己产生浓厚兴趣，开始社交', emoji: '🪞' },
];

// 7个月宝宝预言
const month7 = [
  { id: 'pred_7_1', monthAge: 7, type: 'behavior', content: '本周可能开始敲打一切物品，探索物理定律', emoji: '🔨' },
  { id: 'pred_7_2', monthAge: 7, type: 'speech', content: '即将学会用"啊啊啊"表达各种复杂情绪', emoji: '😤' },
  { id: 'pred_7_3', monthAge: 7, type: 'moment', content: '可能开始怕生陌生人，一看到就开启委屈模式', emoji: '😢' },
  { id: 'pred_7_4', monthAge: 7, type: 'behavior', content: '即将解锁"爬行"技能，家里开始变得像战场', emoji: '🏃' },
  { id: 'pred_7_5', monthAge: 7, type: 'moment', content: '可能第一次成功从坐到爬，兴奋度爆表', emoji: '🎉' },
  { id: 'pred_7_6', monthAge: 7, type: 'behavior', content: '可能开始对锅碗瓢盆产生浓厚兴趣', emoji: '🥄' },
  { id: 'pred_7_7', monthAge: 7, type: 'speech', content: '即将开始模仿咳嗽、吐舌头等动作', emoji: '👅' },
];

// 8个月宝宝预言
const month8 = [
  { id: 'pred_8_1', monthAge: 8, type: 'behavior', content: '即将解锁"把所有东西从桌上推下去"的实验精神', emoji: '📤' },
  { id: 'pred_8_2', monthAge: 8, type: 'speech', content: '可能开始说"拜拜"，虽然每次都说成别的', emoji: '👋' },
  { id: 'pred_8_3', monthAge: 8, type: 'moment', content: '即将学会扶站，站着看世界的感觉真好', emoji: '🧍' },
  { id: 'pred_8_4', monthAge: 8, type: 'behavior', content: '可能开始认人，不喜欢的人抱就哭', emoji: '😭' },
  { id: 'pred_8_5', monthAge: 8, type: 'moment', content: '可能开始用手指指东西，想要的全都指', emoji: '☝️' },
  { id: 'pred_8_6', monthAge: 8, type: 'behavior', content: '即将解锁"藏猫猫"技能，从此乐此不疲', emoji: '🙈' },
  { id: 'pred_8_7', monthAge: 8, type: 'speech', content: '可能开始用尖叫表达兴奋，这是语言发展的必经阶段', emoji: '🤪' },
  { id: 'pred_8_8', monthAge: 8, type: 'moment', content: '可能第一次成功爬过障碍物，成就感满满', emoji: '🏆' },
];

// 9个月宝宝预言
const month9 = [
  { id: 'pred_9_1', monthAge: 9, type: 'behavior', content: '本周可能对抽纸产生执念，抽一张不够，要全部抽出来', emoji: '🧻' },
  { id: 'pred_9_2', monthAge: 9, type: 'speech', content: '即将学会叫"爷爷奶奶"，然后成为他们的最爱', emoji: '👴' },
  { id: 'pred_9_3', monthAge: 9, type: 'moment', content: '可能第一次成功站立几秒，然后一屁股坐下', emoji: '💪' },
  { id: 'pred_9_4', monthAge: 9, type: 'behavior', content: '即将解锁"点头yes摇头no"技能，开始理解社交礼仪', emoji: '👆' },
  { id: 'pred_9_5', monthAge: 9, type: 'moment', content: '可能开始用表情包式沟通，一个眼神全懂', emoji: '👀' },
  { id: 'pred_9_6', monthAge: 9, type: 'behavior', content: '即将对书本产生兴趣，虽然是撕书', emoji: '📚' },
  { id: 'pred_9_7', monthAge: 9, type: 'speech', content: '可能开始用咿咿呀呀和大人"对话"', emoji: '💬' },
];

// 10个月宝宝预言
const month10 = [
  { id: 'pred_10_1', monthAge: 10, type: 'behavior', content: '本周可能对袜子产生敌意，脱掉速度比你穿得快', emoji: '🧦' },
  { id: 'pred_10_2', monthAge: 10, type: 'speech', content: '即将解锁"摇头"技能，拒绝一切从此开始', emoji: '🙅' },
  { id: 'pred_10_3', monthAge: 10, type: 'moment', content: '可能第一次尝试自己吃饭，然后开始抹脸', emoji: '🍚' },
  { id: 'pred_10_4', monthAge: 10, type: 'behavior', content: '即将学会扶走，在家具上扶着移动', emoji: '🚶' },
  { id: 'pred_10_5', monthAge: 10, type: 'moment', content: '可能开始认镜子里的自己，觉得这是另一个宝宝', emoji: '🪞' },
  { id: 'pred_10_6', monthAge: 10, type: 'behavior', content: '即将对遥控器开关产生执念，电视开了关关了开', emoji: '📺' },
  { id: 'pred_10_7', monthAge: 10, type: 'speech', content: '可能开始学动物叫，虽然发音不太标准', emoji: '🐮' },
];

// 11个月宝宝预言
const month11 = [
  { id: 'pred_11_1', monthAge: 11, type: 'behavior', content: '本周可能开始翻箱倒柜，柜子里有什么宝藏', emoji: '🗄️' },
  { id: 'pred_11_2', monthAge: 11, type: 'speech', content: '即将开始说第一个有意义的词，不只是"妈妈"', emoji: '🗣️' },
  { id: 'pred_11_3', monthAge: 11, type: 'moment', content: '可能第一次放手站立，虽然只有几秒钟', emoji: '🤚' },
  { id: 'pred_11_4', monthAge: 11, type: 'behavior', content: '即将解锁"钻箱子"技能，什么容器都要试试', emoji: '📦' },
  { id: 'pred_11_5', monthAge: 11, type: 'moment', content: '可能开始对音乐产生反应，听到就摇摆', emoji: '💃' },
  { id: 'pred_11_6', monthAge: 11, type: 'behavior', content: '即将学会用杯子喝水，虽然洒得到处都是', emoji: '🥛' },
  { id: 'pred_11_7', monthAge: 11, type: 'speech', content: '可能开始理解简单指令，如"给我"、再见"', emoji: '👋' },
];

// 12个月宝宝预言（周岁）
const month12 = [
  { id: 'pred_12_1', monthAge: 12, type: 'behavior', content: '可能突然学会说"不"，并且用得炉火纯青', emoji: '🚫' },
  { id: 'pred_12_2', monthAge: 12, type: 'speech', content: '即将解锁走路的语言适应期，可能开始说更多词', emoji: '🚶' },
  { id: 'pred_12_3', monthAge: 12, type: 'moment', content: '可能第一次独立走几步，摔倒了也要继续', emoji: '🎯' },
  { id: 'pred_12_4', monthAge: 12, type: 'behavior', content: '即将对勺子产生兴趣，坚持要自己吃', emoji: '🥄' },
  { id: 'pred_12_5', monthAge: 12, type: 'moment', content: '可能第一次用蜡笔涂鸦，虽然不知道画的是什么', emoji: '🖍️' },
  { id: 'pred_12_6', monthAge: 12, type: 'speech', content: '即将开始用叠词表达，如"妈妈抱抱"', emoji: '👶' },
  { id: 'pred_12_7', monthAge: 12, type: 'behavior', content: '可能开始对厨房产生强烈兴趣，什么都想碰', emoji: '🍳' },
  { id: 'pred_12_8', monthAge: 12, type: 'moment', content: '即将解锁"周岁"技能，从此人生进入新阶段', emoji: '🎂' },
];

// 13个月宝宝预言
const month13 = [
  { id: 'pred_13_1', monthAge: 13, type: 'behavior', content: '本周可能开始执著于把东西放进容器再倒出来', emoji: '🫙' },
  { id: 'pred_13_2', monthAge: 13, type: 'speech', content: '即将词汇量爆发，突然会说很多新词', emoji: '📈' },
  { id: 'pred_13_3', monthAge: 13, type: 'moment', content: '可能开始对台阶产生执念，非要自己爬上去', emoji: '🪜' },
  { id: 'pred_13_4', monthAge: 13, type: 'behavior', content: '即将解锁"脱衣服"技能，比穿衣服还快', emoji: '👕' },
  { id: 'pred_13_5', monthAge: 13, type: 'moment', content: '可能第一次成功独立走路，成就感爆棚', emoji: '⭐' },
  { id: 'pred_13_6', monthAge: 13, type: 'behavior', content: '即将对沙子产生浓厚兴趣，可以玩一整天', emoji: '🏖️' },
];

// 14个月宝宝预言
const month14 = [
  { id: 'pred_14_1', monthAge: 14, type: 'behavior', content: '即将对冰箱产生执念，每次路过都要你打开', emoji: '🧊' },
  { id: 'pred_14_2', monthAge: 14, type: 'speech', content: '可能开始说短句，如"妈妈的车车"', emoji: '🚗' },
  { id: 'pred_14_3', monthAge: 14, type: 'moment', content: '可能第一次自己用勺子成功舀到食物', emoji: '🥄' },
  { id: 'pred_14_4', monthAge: 14, type: 'behavior', content: '即将解锁"扔球"技能，虽然方向全靠缘分', emoji: '⚽' },
  { id: 'pred_14_5', monthAge: 14, type: 'moment', content: '可能开始认得自己的东西，不让别人碰', emoji: '👜' },
  { id: 'pred_14_6', monthAge: 14, type: 'behavior', content: '即将对雨鞋产生兴趣，穿上就不肯脱', emoji: '👢' },
  { id: 'pred_14_7', monthAge: 14, type: 'speech', content: '可能开始问"这是什么"，每天问八百遍', emoji: '❓' },
];

// 15个月宝宝预言
const month15 = [
  { id: 'pred_15_1', monthAge: 15, type: 'behavior', content: '本周可能开始执著于自己开门关门，乐此不疲', emoji: '🚪' },
  { id: 'pred_15_2', monthAge: 15, type: 'speech', content: '即将词汇量达到50+，开始能用语言表达更多', emoji: '📚' },
  { id: 'pred_15_3', monthAge: 15, type: 'moment', content: '可能第一次踢球，虽然踢不到球', emoji: '⚽' },
  { id: 'pred_15_4', monthAge: 15, type: 'behavior', content: '即将对电梯按钮产生执念，每层都要按', emoji: '🔢' },
  { id: 'pred_15_5', monthAge: 15, type: 'moment', content: '可能开始喜欢和同伴玩耍，虽然是平行玩耍', emoji: '👶' },
  { id: 'pred_15_6', monthAge: 15, type: 'behavior', content: '即将解锁"涂鸦"技能，画作抽象无比', emoji: '🎨' },
];

// 16个月宝宝预言
const month16 = [
  { id: 'pred_16_1', monthAge: 16, type: 'behavior', content: '即将发明新运动——把抽屉里的东西全部搬出来再放回去', emoji: '🗃️' },
  { id: 'pred_16_2', monthAge: 16, type: 'speech', content: '可能开始说"我"，开始有自我意识', emoji: '👤' },
  { id: 'pred_16_3', monthAge: 16, type: 'moment', content: '可能第一次尝试自己穿鞋，虽然穿反了', emoji: '👟' },
  { id: 'pred_16_4', monthAge: 16, type: 'behavior', content: '即将对旋转的东西产生执念，如电风扇', emoji: '🌀' },
  { id: 'pred_16_5', monthAge: 16, type: 'moment', content: '可能开始学唱歌，虽然跑调严重但很认真', emoji: '🎤' },
  { id: 'pred_16_6', monthAge: 16, type: 'behavior', content: '即将解锁"自己吃饭"技能，家里可能变成战场', emoji: '🍽️' },
  { id: 'pred_16_7', monthAge: 16, type: 'speech', content: '可能开始给玩具起名字，当作真朋友', emoji: '🧸' },
];

// 17个月宝宝预言
const month17 = [
  { id: 'pred_17_1', monthAge: 17, type: 'behavior', content: '本周可能开始对马桶产生执念，非要自己冲', emoji: '🚽' },
  { id: 'pred_17_2', monthAge: 17, type: 'speech', content: '即将开始说两三个词的句子，如"妈妈抱抱"', emoji: '💬' },
  { id: 'pred_17_3', monthAge: 17, type: 'moment', content: '可能第一次成功搭起两块积木', emoji: '🧱' },
  { id: 'pred_17_4', monthAge: 17, type: 'behavior', content: '即将对水龙头产生执念，玩水停不下来', emoji: '🚿' },
  { id: 'pred_17_5', monthAge: 17, type: 'moment', content: '可能开始认得家庭成员的照片', emoji: '📷' },
  { id: 'pred_17_6', monthAge: 17, type: 'behavior', content: '即将解锁"帮忙"技能，你做什么都要掺和', emoji: '🧹' },
];

// 18个月宝宝预言
const month18 = [
  { id: 'pred_18_1', monthAge: 18, type: 'moment', content: '即将用勺子舀起空气然后认真喂给你', emoji: '🥄' },
  { id: 'pred_18_2', monthAge: 18, type: 'speech', content: '可能开始说"不要"并配合摇头，拒绝一切', emoji: '🙅' },
  { id: 'pred_18_3', monthAge: 18, type: 'behavior', content: '即将解锁"跑"技能，追都追不上', emoji: '🏃' },
  { id: 'pred_18_4', monthAge: 18, type: 'moment', content: '可能第一次尝试自己脱裤子，虽然总是卡住', emoji: '👖' },
  { id: 'pred_18_5', monthAge: 18, type: 'behavior', content: '即将对沙子、水、泥巴产生强烈兴趣', emoji: '🏖️' },
  { id: 'pred_18_6', monthAge: 18, type: 'speech', content: '可能开始问简单问题，如"狗狗在哪"', emoji: '🐕' },
  { id: 'pred_18_7', monthAge: 18, type: 'moment', content: '即将对垃圾桶产生执念，翻找宝藏', emoji: '🗑️' },
  { id: 'pred_18_8', monthAge: 18, type: 'behavior', content: '可能开始有物权意识，自己的东西不让碰', emoji: '🔒' },
];

// 19个月宝宝预言
const month19 = [
  { id: 'pred_19_1', monthAge: 19, type: 'behavior', content: '本周可能开始对洗手产生执念，要洗很久很久', emoji: '🧼' },
  { id: 'pred_19_2', monthAge: 19, type: 'speech', content: '即将词汇量突破100，开始语言大爆发', emoji: '📖' },
  { id: 'pred_19_3', monthAge: 19, type: 'moment', content: '可能第一次尝试双脚跳，虽然跳不起来', emoji: '🦘' },
  { id: 'pred_19_4', monthAge: 19, type: 'behavior', content: '即将对各种按钮产生执念，见一个按一个', emoji: '🔘' },
  { id: 'pred_19_5', monthAge: 19, type: 'moment', content: '可能开始模仿大人打电话，像个小大人', emoji: '📱' },
  { id: 'pred_19_6', monthAge: 19, type: 'behavior', content: '即将解锁"自己刷牙"技能，牙膏蹭蹭就行', emoji: '🪥' },
];

// 20个月宝宝预言
const month20 = [
  { id: 'pred_20_1', monthAge: 20, type: 'speech', content: '可能把所有圆形的东西都叫"蛋蛋"', emoji: '🥚' },
  { id: 'pred_20_2', monthAge: 20, type: 'behavior', content: '即将开始对数字产生兴趣，要数一切', emoji: '🔢' },
  { id: 'pred_20_3', monthAge: 20, type: 'moment', content: '可能第一次成功用脚踢球', emoji: '⚽' },
  { id: 'pred_20_4', monthAge: 20, type: 'behavior', content: '即将解锁"自己倒水"技能，洒出来没关系', emoji: '🫗' },
  { id: 'pred_20_5', monthAge: 20, type: 'moment', content: '可能开始喜欢画画，画完还要展示给每个人看', emoji: '🖼️' },
  { id: 'pred_20_6', monthAge: 20, type: 'speech', content: '可能开始说完整的句子，如"妈妈我想喝水"', emoji: '💧' },
  { id: 'pred_20_7', monthAge: 20, type: 'behavior', content: '即将对各种容器产生执念，什么都想装进去', emoji: '🫙' },
];

// 21个月宝宝预言
const month21 = [
  { id: 'pred_21_1', monthAge: 21, type: 'behavior', content: '本周可能开始执著于按电梯的楼层按钮', emoji: '🛗' },
  { id: 'pred_21_2', monthAge: 21, type: 'speech', content: '即将开始唱儿歌，虽然歌词全是自己编的', emoji: '🎵' },
  { id: 'pred_21_3', monthAge: 21, type: 'moment', content: '可能第一次成功画出直线', emoji: '📏' },
  { id: 'pred_21_4', monthAge: 21, type: 'behavior', content: '即将解锁"自己脱外套"技能，穿起来还不行', emoji: '🧥' },
  { id: 'pred_21_5', monthAge: 21, type: 'moment', content: '可能开始有想象力，开始假装游戏', emoji: '🎭' },
  { id: 'pred_21_6', monthAge: 21, type: 'behavior', content: '即将对泡泡产生强烈兴趣，见泡泡必追', emoji: '🫧' },
  { id: 'pred_21_7', monthAge: 21, type: 'speech', content: '可能开始用语言表达情绪，不只是哭闹', emoji: '😤' },
];

// 22个月宝宝预言
const month22 = [
  { id: 'pred_22_1', monthAge: 22, type: 'behavior', content: '即将对帽子宣战，戴上的瞬间立刻扯掉', emoji: '🧢' },
  { id: 'pred_22_2', monthAge: 22, type: 'speech', content: '可能开始说"我的"，物权意识强烈爆发', emoji: '✋' },
  { id: 'pred_22_3', monthAge: 22, type: 'moment', content: '可能第一次成功用蜡笔画出圆圈', emoji: '⭕' },
  { id: 'pred_22_4', monthAge: 22, type: 'behavior', content: '即将解锁"自己穿裤子"技能，但总是穿反', emoji: '👖' },
  { id: 'pred_22_5', monthAge: 22, type: 'moment', content: '可能开始有"怕"的情绪，怕黑怕大声音', emoji: '😨' },
  { id: 'pred_22_6', monthAge: 22, type: 'behavior', content: '即将对遥控器产生执念，电视听他的', emoji: '📺' },
  { id: 'pred_22_7', monthAge: 22, type: 'speech', content: '可能开始用句子描述简单的事情', emoji: '📝' },
];

// 23个月宝宝预言
const month23 = [
  { id: 'pred_23_1', monthAge: 23, type: 'behavior', content: '本周可能开始执著于自己开门关门，学会了就不停重复', emoji: '🚪' },
  { id: 'pred_23_2', monthAge: 23, type: 'speech', content: '即将开始说"因为...所以..."这样的因果句', emoji: '🧠' },
  { id: 'pred_23_3', monthAge: 23, type: 'moment', content: '可能第一次成功双脚跳起来', emoji: '🦘' },
  { id: 'pred_23_4', monthAge: 23, type: 'behavior', content: '即将解锁"自己洗手"技能，袖子湿了没关系', emoji: '🧼' },
  { id: 'pred_23_5', monthAge: 23, type: 'moment', content: '可能开始模仿大人做家务，像个小帮手', emoji: '🧹' },
  { id: 'pred_23_6', monthAge: 23, type: 'behavior', content: '即将对积木产生浓厚兴趣，搭高再推倒', emoji: '🧱' },
  { id: 'pred_23_7', monthAge: 23, type: 'speech', content: '可能开始问"为什么"，每天问不停', emoji: '❓' },
];

// 24个月宝宝预言（两岁）
const month24 = [
  { id: 'pred_24_1', monthAge: 24, type: 'moment', content: '即将对着镜子里的自己热情打招呼，仿佛认识了新朋友', emoji: '🪞' },
  { id: 'pred_24_2', monthAge: 24, type: 'speech', content: '可能开始说"不"，拒绝你的一切帮助和建议', emoji: '🙅' },
  { id: 'pred_24_3', monthAge: 24, type: 'behavior', content: '即将进入Terrible Two，什么都要"我自己来"', emoji: '😤' },
  { id: 'pred_24_4', monthAge: 24, type: 'moment', content: '可能第一次用"我"来表达自己，有自我意识了', emoji: '👤' },
  { id: 'pred_24_5', monthAge: 24, type: 'behavior', content: '即将解锁"双脚交替下楼"技能', emoji: '🪜' },
  { id: 'pred_24_6', monthAge: 24, type: 'speech', content: '可能开始说简单儿歌，虽然只有几句', emoji: '🎶' },
  { id: 'pred_24_7', monthAge: 24, type: 'moment', content: '可能开始有"朋友"的概念，虽然只是平行玩耍', emoji: '👫' },
  { id: 'pred_24_8', monthAge: 24, type: 'behavior', content: '即将解锁"说名字"技能，能告诉别人自己叫什么', emoji: '💬' },
];

// 25个月宝宝预言
const month25 = [
  { id: 'pred_25_1', monthAge: 25, type: 'behavior', content: '本周可能开始对各种开关产生执念，见一个按一个', emoji: '🔌' },
  { id: 'pred_25_2', monthAge: 25, type: 'speech', content: '即将词汇量爆发，能说越来越多的话了', emoji: '📚' },
  { id: 'pred_25_3', monthAge: 25, type: 'moment', content: '可能第一次成功骑平衡车或三轮车', emoji: '🚲' },
  { id: 'pred_25_4', monthAge: 25, type: 'behavior', content: '即将解锁"自己拉拉链"技能，拉上就拉不开', emoji: '🤝' },
  { id: 'pred_25_5', monthAge: 25, type: 'moment', content: '可能开始假装游戏，给娃娃喂饭讲故事', emoji: '🧸' },
  { id: 'pred_25_6', monthAge: 25, type: 'behavior', content: '即将对画画产生更浓厚的兴趣，画作越来越多', emoji: '🎨' },
];

// 26个月宝宝预言
const month26 = [
  { id: 'pred_26_1', monthAge: 26, type: 'speech', content: '本周可能突然掌握"为什么"这个词，且使用频率极高', emoji: '❓' },
  { id: 'pred_26_2', monthAge: 26, type: 'behavior', content: '即将进入"可怕的两岁半"，执拗期来临', emoji: '😤' },
  { id: 'pred_26_3', monthAge: 26, type: 'moment', content: '可能第一次尝试自己剪纸，虽然剪不整齐', emoji: '✂️' },
  { id: 'pred_26_4', monthAge: 26, type: 'behavior', content: '即将解锁"双脚跳远"技能，越跳越远', emoji: '🦘' },
  { id: 'pred_26_5', monthAge: 26, type: 'moment', content: '可能开始有"分享"意识，虽然还是偶尔', emoji: '🤝' },
  { id: 'pred_26_6', monthAge: 26, type: 'speech', content: '可能开始说完整的故事，虽然是自己编的', emoji: '📖' },
  { id: 'pred_26_7', monthAge: 26, type: 'behavior', content: '即将对厨房操作台产生执念，要帮忙做饭', emoji: '🍳' },
];

// 27个月宝宝预言
const month27 = [
  { id: 'pred_27_1', monthAge: 27, type: 'behavior', content: '本周可能开始对顺序产生执念，什么都要排好队', emoji: '📏' },
  { id: 'pred_27_2', monthAge: 27, type: 'speech', content: '即将开始唱完整的儿歌，发音越来越清晰', emoji: '🎤' },
  { id: 'pred_27_3', monthAge: 27, type: 'moment', content: '可能第一次成功用筷子，虽然夹不住', emoji: '🥢' },
  { id: 'pred_27_4', monthAge: 27, type: 'behavior', content: '即将解锁"单脚站"技能，坚持几秒钟', emoji: '🦶' },
  { id: 'pred_27_5', monthAge: 27, type: 'moment', content: '可能开始关心其他小朋友，有同理心了', emoji: '💕' },
  { id: 'pred_27_6', monthAge: 27, type: 'behavior', content: '即将对磁力片、拼图等玩具产生浓厚兴趣', emoji: '🧲' },
];

// 28个月宝宝预言
const month28 = [
  { id: 'pred_28_1', monthAge: 28, type: 'moment', content: '即将试图给猫/狗喂饭，态度非常真诚', emoji: '🐱' },
  { id: 'pred_28_2', monthAge: 28, type: 'speech', content: '可能开始说"但是"、"然后"等连接词', emoji: '🔗' },
  { id: 'pred_28_3', monthAge: 28, type: 'behavior', content: '即将对拼图产生执念，从简单到复杂', emoji: '🧩' },
  { id: 'pred_28_4', monthAge: 28, type: 'moment', content: '可能第一次尝试自己系扣子，扣错了很有成就感', emoji: '🔘' },
  { id: 'pred_28_5', monthAge: 28, type: 'behavior', content: '即将解锁"自己脱衣服"技能，比你快', emoji: '👕' },
  { id: 'pred_28_6', monthAge: 28, type: 'speech', content: '可能开始有幽默感，喜欢逗别人笑', emoji: '😄' },
  { id: 'pred_28_7', monthAge: 28, type: 'moment', content: '可能开始扮演各种职业角色，如医生厨师', emoji: '👨‍⚕️' },
];

// 29个月宝宝预言
const month29 = [
  { id: 'pred_29_1', monthAge: 29, type: 'behavior', content: '本周可能开始对时间产生好奇，"昨天"和"明天"不分', emoji: '⏰' },
  { id: 'pred_29_2', monthAge: 29, type: 'speech', content: '即将词汇量达到500+，开始像个话痨', emoji: '💬' },
  { id: 'pred_29_3', monthAge: 29, type: 'moment', content: '可能第一次成功跨骑三轮车，开始骑车探索', emoji: '🚲' },
  { id: 'pred_29_4', monthAge: 29, type: 'behavior', content: '即将解锁"自己梳头"技能，虽然头发越梳越乱', emoji: '👧' },
  { id: 'pred_29_5', monthAge: 29, type: 'moment', content: '可能开始有数字概念，能数到10了', emoji: '🔢' },
  { id: 'pred_29_6', monthAge: 29, type: 'behavior', content: '即将对各种车产生浓厚兴趣，要认所有车牌', emoji: '🚗' },
];

// 30个月宝宝预言
const month30 = [
  { id: 'pred_30_1', monthAge: 30, type: 'behavior', content: '即将坚持自己穿鞋，但左右永远反着', emoji: '👟' },
  { id: 'pred_30_2', monthAge: 30, type: 'speech', content: '可能开始用"我觉得"表达想法', emoji: '🤔' },
  { id: 'pred_30_3', monthAge: 30, type: 'moment', content: '可能第一次成功用筷子夹起东西', emoji: '🥢' },
  { id: 'pred_30_4', monthAge: 30, type: 'behavior', content: '即将对各种颜色产生兴趣，要给所有东西分类', emoji: '🌈' },
  { id: 'pred_30_5', monthAge: 30, type: 'moment', content: '可能开始问关于出生的问题，"我从哪里来的"', emoji: '🤰' },
  { id: 'pred_30_6', monthAge: 30, type: 'speech', content: '可能开始说长句子，能描述发生的事情', emoji: '📝' },
  { id: 'pred_30_7', monthAge: 30, type: 'behavior', content: '即将解锁"自己整理玩具"技能，虽然只整理一部分', emoji: '🧸' },
];

// 31个月宝宝预言
const month31 = [
  { id: 'pred_31_1', monthAge: 31, type: 'behavior', content: '本周可能开始对性别产生好奇，问为什么不一样', emoji: '👫' },
  { id: 'pred_31_2', monthAge: 31, type: 'speech', content: '即将能背诵儿歌和古诗，虽然不知道含义', emoji: '📜' },
  { id: 'pred_31_3', monthAge: 31, type: 'moment', content: '可能第一次成功单脚跳了几下', emoji: '🦘' },
  { id: 'pred_31_4', monthAge: 31, type: 'behavior', content: '即将对认字产生兴趣，想知道这是什么字', emoji: '🔤' },
  { id: 'pred_31_5', monthAge: 31, type: 'moment', content: '可能开始和小朋友合作玩耍，不再只是平行玩耍', emoji: '👫' },
  { id: 'pred_31_6', monthAge: 31, type: 'behavior', content: '即将解锁"自己扣子母扣"技能', emoji: '🔗' },
];

// 32个月宝宝预言
const month32 = [
  { id: 'pred_32_1', monthAge: 32, type: 'speech', content: '可能发明一个谁也听不懂的词，但态度坚定地反复使用', emoji: '🤪' },
  { id: 'pred_32_2', monthAge: 32, type: 'behavior', content: '即将对形状产生执念，所有东西都要问是什么形状', emoji: '🔷' },
  { id: 'pred_32_3', monthAge: 32, type: 'moment', content: '可能第一次成功骑两轮自行车（带辅助轮）', emoji: '🚲' },
  { id: 'pred_32_4', monthAge: 32, type: 'behavior', content: '即将解锁"自己系鞋带"技能，虽然系不紧', emoji: '👟' },
  { id: 'pred_32_5', monthAge: 32, type: 'speech', content: '可能开始有逻辑地讲述事情的经过', emoji: '🧠' },
  { id: 'pred_32_6', monthAge: 32, type: 'moment', content: '可能开始扮演"老师"角色，给玩具上课', emoji: '👩‍🏫' },
  { id: 'pred_32_7', monthAge: 32, type: 'behavior', content: '即将对字母产生兴趣，想知道怎么写', emoji: '🔤' },
];

// 33个月宝宝预言
const month33 = [
  { id: 'pred_33_1', monthAge: 33, type: 'behavior', content: '本周可能开始对"公平"产生执念，什么都要一样多', emoji: '⚖️' },
  { id: 'pred_33_2', monthAge: 33, type: 'speech', content: '即将能说完整的自我介绍，包括名字年龄', emoji: '👤' },
  { id: 'pred_33_3', monthAge: 33, type: 'moment', content: '可能第一次尝试写自己的名字，虽然是乱画', emoji: '✍️' },
  { id: 'pred_33_4', monthAge: 33, type: 'behavior', content: '即将解锁"自己整理书包"技能', emoji: '🎒' },
  { id: 'pred_33_5', monthAge: 33, type: 'moment', content: '可能开始理解过去和未来的概念', emoji: '⏳' },
  { id: 'pred_33_6', monthAge: 33, type: 'behavior', content: '即将对简单排序产生兴趣，如大小长短', emoji: '📏' },
];

// 34个月宝宝预言
const month34 = [
  { id: 'pred_34_1', monthAge: 34, type: 'moment', content: '即将对某个不存在的规则极其执着，比如"必须先迈左脚"', emoji: '🦶' },
  { id: 'pred_34_2', monthAge: 34, type: 'speech', content: '可能开始用"如果...就..."表达假设', emoji: '🔮' },
  { id: 'pred_34_3', monthAge: 34, type: 'behavior', content: '即将解锁"自己洗手绢"技能', emoji: '🧺' },
  { id: 'pred_34_4', monthAge: 34, type: 'moment', content: '可能第一次成功用蜡笔画出人的形状（头+身体）', emoji: '🧍' },
  { id: 'pred_34_5', monthAge: 34, type: 'behavior', content: '即将对认字产生强烈兴趣，走到哪里都在认字', emoji: '📖' },
  { id: 'pred_34_6', monthAge: 34, type: 'speech', content: '可能开始能讲完整的小故事', emoji: '📚' },
  { id: 'pred_34_7', monthAge: 34, type: 'moment', content: '可能开始有"最好的朋友"的概念', emoji: '👯' },
];

// 35个月宝宝预言
const month35 = [
  { id: 'pred_35_1', monthAge: 35, type: 'behavior', content: '本周可能开始对"秘密"产生好奇，想知道秘密是什么', emoji: '🤫' },
  { id: 'pred_35_2', monthAge: 35, type: 'speech', content: '即将能数数到20以上，开始理解数量关系', emoji: '🔢' },
  { id: 'pred_35_3', monthAge: 35, type: 'moment', content: '可能第一次成功用筷子夹起花生米', emoji: '🥜' },
  { id: 'pred_35_4', monthAge: 35, type: 'behavior', content: '即将解锁"自己叠衣服"技能，虽然叠不整齐', emoji: '👕' },
  { id: 'pred_35_5', monthAge: 35, type: 'moment', content: '可能开始对时间产生概念，知道早上晚上', emoji: '🌅' },
  { id: 'pred_35_6', monthAge: 35, type: 'behavior', content: '即将对简单的加减产生兴趣', emoji: '➕' },
];

// 36个月宝宝预言（三岁）
const month36 = [
  { id: 'pred_36_1', monthAge: 36, type: 'speech', content: '可能学会说"我自己来"，且对一切事务行使否决权', emoji: '🙅' },
  { id: 'pred_36_2', monthAge: 36, type: 'behavior', content: '即将进入入园准备期，开始有社交压力', emoji: '🏫' },
  { id: 'pred_36_3', monthAge: 36, type: 'moment', content: '可能第一次成功骑真正的两轮自行车', emoji: '🚲' },
  { id: 'pred_36_4', monthAge: 36, type: 'behavior', content: '即将解锁"自己刷牙洗脸"完全独立', emoji: '🪥' },
  { id: 'pred_36_5', monthAge: 36, type: 'moment', content: '可能开始问"死"是什么，产生生命意识', emoji: '🌱' },
  { id: 'pred_36_6', monthAge: 36, type: 'speech', content: '可能能唱完整的歌，背诵多首儿歌', emoji: '🎵' },
  { id: 'pred_36_7', monthAge: 36, type: 'behavior', content: '即将开始有更好的自控力，能等待一会儿', emoji: '⏰' },
  { id: 'pred_36_8', monthAge: 36, type: 'moment', content: '可能第一次主动和别人分享玩具，且感到快乐', emoji: '🎁' },
];

// 合并所有预言数据
export const babyPredictions = [
  ...month0,
  ...month1,
  ...month2,
  ...month3,
  ...month4,
  ...month5,
  ...month6,
  ...month7,
  ...month8,
  ...month9,
  ...month10,
  ...month11,
  ...month12,
  ...month13,
  ...month14,
  ...month15,
  ...month16,
  ...month17,
  ...month18,
  ...month19,
  ...month20,
  ...month21,
  ...month22,
  ...month23,
  ...month24,
  ...month25,
  ...month26,
  ...month27,
  ...month28,
  ...month29,
  ...month30,
  ...month31,
  ...month32,
  ...month33,
  ...month34,
  ...month35,
  ...month36,
];

// 按月龄分组的懒加载缓存（不自动计算，按需生成）
const _monthCache = {};

// 获取指定月龄的预言（懒加载，只计算请求的月龄）
export const getPredictionsByMonthAge = (monthAge) => {
  if (_monthCache[monthAge]) return _monthCache[monthAge];
  const result = babyPredictions.filter(p => p.monthAge === monthAge);
  _monthCache[monthAge] = result;
  return result;
};

// 按需获取分组（兼容旧引用）
export const predictionsByMonth = new Proxy({}, {
  get(_, monthAge) {
    return getPredictionsByMonthAge(Number(monthAge));
  }
});

// 预言类型配置
export const predictionTypes = {
  behavior: {
    label: '行为',
    emoji: '🎯',
    gradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
  speech: {
    label: '语言',
    emoji: '💬',
    gradient: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-500',
  },
  moment: {
    label: '名场面',
    emoji: '✨',
    gradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
  },
};
