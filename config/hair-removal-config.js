// Hair Removal Device Check-in System Configuration - 脱毛仪打卡系统配置
const hairRemovalConfig = {
  // API Configuration - API配置
  accessToken: "9f43664de2ca43df41b8c78b1ea88019", // Gitee API访问令牌
  repoOwner: "yxnbkls", // Gitee仓库所有者用户名
  cloudRepoName: "storge", // 云端仓库名称，用于存储应用配置
  configFilePath: "hair_removal_config.json", // 脱毛仪配置文件路径
  checkInDataPath: "hair_removal_checkins.json", // 打卡数据文件路径
  usersDataPath: "hair_removal_users.json", // 用户数据文件路径

  // Admin Configuration - 管理员配置
  ADMIN_USERNAME: "admin", // 管理员用户名
  ADMIN_PASSWORD: "admin123", // 管理员密码

  // System Configuration - 系统配置
  appName: "脱毛仪打卡系统",
  version: "1.0.0",
  maxCheckInsPerDay: 2, // 每日最大打卡次数
  reminderIntervalHours: 48, // 提醒间隔小时数

  // Device Types - 设备类型
  deviceTypes: [
    { id: "ipl", name: "IPL脱毛仪", icon: "✨" },
    { id: "laser", name: "激光脱毛仪", icon: "🔆" },
    { id: "epilator", name: "电动脱毛器", icon: "⚡" },
  ],

  // Body Areas - 身体部位
  bodyAreas: [
    { id: "face", name: "面部", icon: "😊" },
    { id: "arms", name: "手臂", icon: "💪" },
    { id: "legs", name: "腿部", icon: "🦵" },
    { id: "underarms", name: "腋下", icon: "🙋" },
    { id: "bikini", name: "比基尼线", icon: "👙" },
    { id: "back", name: "背部", icon: "🔄" },
  ],
}

export default hairRemovalConfig
