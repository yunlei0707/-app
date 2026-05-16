/**
 * 系统默认宝宝（豆芽）的示例数据
 * 作为新用户的使用教程和参考
 */

export const DEFAULT_BABY = {
  id: "default",
  name: "豆芽",
  birthday: "11月4日",
  isSystem: true,
  avatar: "👶",
  data: {
    timeline: [
      {
        id: "default_1",
        type: "photo",
        title: "第一次抬头",
        content: "今天豆芽居然自己抬头了！虽然只有几秒钟，但老父亲激动得差点哭出来 💕",
        date: "2023-11-20",
        photos: [],
        mood: "happy",
        createdAt: "2023-11-20T10:30:00.000Z"
      },
      {
        id: "default_2",
        type: "milestone",
        title: "第一次翻身",
        content: "三个月啦！今天第一次自己翻身成功，棒棒的！🎉",
        date: "2024-02-04",
        photos: [],
        mood: "happy",
        createdAt: "2024-02-04T15:20:00.000Z"
      },
      {
        id: "default_3",
        type: "diary",
        title: "去公园玩耍",
        content: "今天天气特别好，带豆芽去公园晒晒太阳。看着她好奇地看着周围的一切，感觉时间都慢下来了。",
        date: "2024-03-15",
        photos: [],
        mood: "peaceful",
        createdAt: "2024-03-15T09:45:00.000Z"
      },
      {
        id: "default_4",
        type: "milestone",
        title: "长出第一颗牙",
        content: "终于等到这一天！豆芽的下门牙冒出来一点点啦，摸起来硬硬的，像颗小珍珠~",
        date: "2024-05-10",
        photos: [],
        mood: "excited",
        createdAt: "2024-05-10T20:15:00.000Z"
      },
      {
        id: "default_5",
        type: "photo",
        title: "半岁纪念",
        content: "六个月啦！时间过得真快，从小小的一点点长到现在会坐会玩了。宝贝，谢谢你选择我们做你的爸爸妈妈 ❤️",
        date: "2024-05-04",
        photos: [],
        mood: "happy",
        createdAt: "2024-05-04T12:00:00.000Z"
      }
    ],
    growth: {
      height: [
        { date: "2023-11-04", value: 50, note: "出生" },
        { date: "2023-12-04", value: 54, note: "满月" },
        { date: "2024-01-04", value: 58, note: "2个月" },
        { date: "2024-02-04", value: 62, note: "3个月" },
        { date: "2024-03-04", value: 65, note: "4个月" },
        { date: "2024-04-04", value: 67, note: "5个月" },
        { date: "2024-05-04", value: 69, note: "6个月" }
      ],
      weight: [
        { date: "2023-11-04", value: 3.2, note: "出生" },
        { date: "2023-12-04", value: 4.5, note: "满月" },
        { date: "2024-01-04", value: 5.8, note: "2个月" },
        { date: "2024-02-04", value: 7.0, note: "3个月" },
        { date: "2024-03-04", value: 7.8, note: "4个月" },
        { date: "2024-04-04", value: 8.5, note: "5个月" },
        { date: "2024-05-04", value: 9.2, note: "6个月" }
      ]
    },
    virtualTime: [
      {
        id: "vt_1",
        title: "10年后的豆芽",
        content: "想象一下10年后豆芽长成小姑娘的样子，应该会很可爱吧~",
        date: "2034-05-04",
        createdAt: "2024-01-15T08:00:00.000Z"
      }
    ]
  }
};

// 默认宝宝的头像选项
export const DEFAULT_AVATARS = ["👶", "👧", "👦", "🍼", "🌟", "🎀", "👑", "🦄"];

export default DEFAULT_BABY;
