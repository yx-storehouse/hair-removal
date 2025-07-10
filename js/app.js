import hairRemovalConfig from "../config/hair-removal-config.js"

class HairRemovalApp {
  constructor() {
    this.config = hairRemovalConfig
    this.currentUser = null
    this.users = []
    this.checkIns = []
    this.currentTab = "checkin"
    this.currentCalendarDate = new Date()
    this.currentView = "calendar"
    this.charts = {}
    this.selectedCheckInDate = null // 新增：补卡日期
    this.recheckinCalendarDate = new Date() // 新增：补卡日历当前月
    this.init()
  }

  async init() {
    this.showLoading()
    // 检查本地缓存的用户
    const cachedUser = localStorage.getItem('hairRemovalUser')
    if (cachedUser) {
      try {
        this.currentUser = JSON.parse(cachedUser)
        await this.loadData()
        this.hideLoading()
        this.showMainScreen()
        return
      } catch (e) {
        localStorage.removeItem('hairRemovalUser')
      }
    }
    await this.loadData()
    this.setupEventListeners()
    this.hideLoading()
    this.showLoginScreen()
  }

  showLoading() {
    document.getElementById("loading-screen").style.display = "flex"
  }

  hideLoading() {
    document.getElementById("loading-screen").style.display = "none"
  }

  showLoginScreen() {
    document.getElementById("login-screen").classList.add("active")
    document.getElementById("main-screen").classList.remove("active")
  }

  showMainScreen() {
    document.getElementById("login-screen").classList.remove("active")
    document.getElementById("main-screen").classList.add("active")
    this.updateUI()
    this.setupEventListeners() // 确保事件绑定
  }

  setupEventListeners() {
    // Login events
    document.getElementById("login-btn").addEventListener("click", () => this.handleLogin())
    document.getElementById("register-btn").addEventListener("click", () => this.handleRegister())

    // Navigation events
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => this.switchTab(e.target.closest(".nav-item").dataset.tab))
    })

    // Header events
    document.getElementById("logout-btn").addEventListener("click", () => this.handleLogout())
    document.getElementById("admin-btn").addEventListener("click", () => this.showAdminPanel())

    // Check-in events
    document.getElementById("checkin-submit").addEventListener("click", () => this.handleCheckIn())
    document.getElementById("intensity").addEventListener("input", (e) => {
      document.getElementById("intensity-value").textContent = e.target.value
    })

    // Profile events
    document.getElementById("export-data").addEventListener("click", () => this.exportData())
    document.getElementById("clear-data").addEventListener("click", () => this.clearData())

    // Modal events
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", (e) => this.closeModal(e.target.closest(".modal")))
    })
    // 新增：点击modal背景关闭弹窗
    document.querySelectorAll('.modal').forEach((modal) => {
      modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) this.closeModal(modal)
      })
      // 兼容移动端
      modal.addEventListener('touchstart', (e) => {
        if (e.target === modal) this.closeModal(modal)
      })
    })

    // History filter
    document.getElementById("history-filter").addEventListener("change", () => this.updateHistoryDisplay())

    // Enter key for login
    document.getElementById("password").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleLogin()
    })

    // Calendar events
    document.getElementById("prev-month").addEventListener("click", () => this.changeMonth(-1))
    document.getElementById("next-month").addEventListener("click", () => this.changeMonth(1))

    // View toggle events
    document.getElementById("calendar-view-btn").addEventListener("click", () => this.toggleView("calendar"))
    document.getElementById("list-view-btn").addEventListener("click", () => this.toggleView("list"))

    // 日期点击弹出补卡modal
    document.getElementById("current-date").addEventListener("click", () => this.showRecheckinCalendarModal())
    // 补卡modal关闭
    document.querySelectorAll("#recheckin-calendar-modal .modal-close").forEach((btn) => {
      btn.addEventListener("click", () => this.closeModal(document.getElementById("recheckin-calendar-modal")))
    })
    // 补卡日历切换
    document.getElementById("recheckin-prev-month").addEventListener("click", () => this.changeRecheckinMonth(-1))
    document.getElementById("recheckin-next-month").addEventListener("click", () => this.changeRecheckinMonth(1))

    // 编辑表单强度显示
    document.getElementById("edit-intensity").addEventListener("input", (e) => {
      document.getElementById("edit-intensity-value").textContent = e.target.value
    })
    // 编辑表单提交
    document.getElementById("edit-checkin-form").addEventListener("submit", (e) => this.handleEditCheckInSubmit(e))

    // 打卡照片上传预览
    const checkinPhotoInput = document.getElementById("checkin-photo")
    if (checkinPhotoInput) {
      checkinPhotoInput.addEventListener("change", (e) => {
        const file = e.target.files[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = function(evt) {
            document.getElementById("checkin-photo-preview").innerHTML = `<img src='${evt.target.result}' alt='打卡照片'>`
            checkinPhotoInput.dataset.base64 = evt.target.result
          }
          reader.readAsDataURL(file)
        } else {
          document.getElementById("checkin-photo-preview").innerHTML = ""
          checkinPhotoInput.dataset.base64 = ""
        }
      })
    }
    // 编辑照片上传预览
    const editPhotoInput = document.getElementById("edit-photo")
    if (editPhotoInput) {
      editPhotoInput.addEventListener("change", (e) => {
        const file = e.target.files[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = function(evt) {
            document.getElementById("edit-photo-preview").innerHTML = `<img src='${evt.target.result}' alt='打卡照片'>`
            editPhotoInput.dataset.base64 = evt.target.result
          }
          reader.readAsDataURL(file)
        } else {
          document.getElementById("edit-photo-preview").innerHTML = ""
          editPhotoInput.dataset.base64 = ""
        }
      })
    }
    // 大图预览modal关闭
    document.querySelectorAll('#photo-preview-modal .modal-close').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal(document.getElementById('photo-preview-modal')))
    })
    // 点击modal背景关闭大图
    const photoModal = document.getElementById('photo-preview-modal')
    if (photoModal) {
      photoModal.addEventListener('mousedown', (e) => {
        if (e.target === photoModal) this.closeModal(photoModal)
      })
      photoModal.addEventListener('touchstart', (e) => {
        if (e.target === photoModal) this.closeModal(photoModal)
      })
    }
  }

  async loadData() {
    try {
      // Load users data
      const usersData = await this.loadFromGitee(this.config.usersDataPath)
      this.users = usersData || []

      // Load check-ins data
      const checkInsData = await this.loadFromGitee(this.config.checkInDataPath)
      this.checkIns = checkInsData || []
    } catch (error) {
      console.error("Error loading data:", error)
      // Initialize with empty data if loading fails
      this.users = []
      this.checkIns = []
    }
  }

  async loadFromGitee(filePath) {
    try {
      const response = await fetch(
        `https://gitee.com/api/v5/repos/${this.config.repoOwner}/${this.config.cloudRepoName}/contents/${filePath}?access_token=${this.config.accessToken}`,
      )

      if (response.ok) {
        const data = await response.json()
        const content = atob(data.content)
        return JSON.parse(content)
      }
      return null
    } catch (error) {
      console.error("Error loading from Gitee:", error)
      return null
    }
  }

  async saveToGitee(filePath, data) {
    try {
      const content = btoa(JSON.stringify(data, null, 2))

      // First, try to get the file to get its SHA
      let sha = null
      try {
        const getResponse = await fetch(
          `https://gitee.com/api/v5/repos/${this.config.repoOwner}/${this.config.cloudRepoName}/contents/${filePath}?access_token=${this.config.accessToken}`,
        )
        if (getResponse.ok) {
          const fileData = await getResponse.json()
          sha = fileData.sha
        }
      } catch (e) {
        // File doesn't exist, that's okay
      }

      const body = {
        access_token: this.config.accessToken,
        content: content,
        message: `Update ${filePath}`,
      }

      if (sha) {
        body.sha = sha
      }

      const response = await fetch(
        `https://gitee.com/api/v5/repos/${this.config.repoOwner}/${this.config.cloudRepoName}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      )

      return response.ok
    } catch (error) {
      console.error("Error saving to Gitee:", error)
      return false
    }
  }

  async handleLogin() {
    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value.trim()
    if (!username || !password) {
      alert("请输入用户名和密码")
      return
    }
    // Check admin login
    if (username === this.config.ADMIN_USERNAME && password === this.config.ADMIN_PASSWORD) {
      this.currentUser = { username, isAdmin: true }
      localStorage.setItem('hairRemovalUser', JSON.stringify(this.currentUser)) // 缓存
      this.showMainScreen()
      return
    }
    // Check regular user login
    const user = this.users.find((u) => u.username === username && u.password === password)
    if (user) {
      this.currentUser = user
      localStorage.setItem('hairRemovalUser', JSON.stringify(this.currentUser)) // 缓存
      this.showMainScreen()
    } else {
      alert("用户名或密码错误")
    }
  }

  async handleRegister() {
    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value.trim()

    if (!username || !password) {
      alert("请输入用户名和密码")
      return
    }

    if (username === this.config.ADMIN_USERNAME) {
      alert("该用户名不可用")
      return
    }

    if (this.users.find((u) => u.username === username)) {
      alert("用户名已存在")
      return
    }

    const newUser = {
      id: Date.now().toString(),
      username,
      password,
      createdAt: new Date().toISOString(),
      settings: {
        reminderEnabled: true,
        reminderTime: "20:00",
      },
    }

    this.users.push(newUser)
    await this.saveToGitee(this.config.usersDataPath, this.users)

    alert("注册成功！请登录")
  }

  handleLogout() {
    this.currentUser = null
    localStorage.removeItem('hairRemovalUser') // 清除缓存
    document.getElementById("username").value = ""
    document.getElementById("password").value = ""
    this.showLoginScreen()
  }

  switchTab(tabName) {
    // Update navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active")
    })
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

    // Update content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active")
    })
    document.getElementById(`${tabName}-tab`).classList.add("active")

    this.currentTab = tabName

    // Update specific tab content
    switch (tabName) {
      case "checkin":
        this.updateCheckInTab()
        break
      case "history":
        if (this.currentView === "calendar") {
          this.updateCalendarDisplay()
        } else {
          this.updateHistoryDisplay()
        }
        break
      case "stats":
        this.updateStatsDisplay()
        break
      case "profile":
        this.updateProfileTab()
        break
    }
  }

  updateUI() {
    // Update user info
    document.getElementById("user-name").textContent = this.currentUser.username

    // Update today's check-in count
    const today = new Date().toDateString()
    const todayCheckIns = this.checkIns.filter(
      (c) => c.userId === this.currentUser.id && new Date(c.timestamp).toDateString() === today,
    ).length

    document.getElementById("user-stats").textContent = `今日已打卡 ${todayCheckIns} 次`

    // Show/hide admin button
    const adminBtn = document.getElementById("admin-btn")
    if (this.currentUser.isAdmin) {
      adminBtn.style.display = "block"
    } else {
      adminBtn.style.display = "none"
    }

    // Update current date
    document.getElementById("current-date").textContent = new Date().toLocaleDateString("zh-CN")

    // Initialize tabs
    this.updateCheckInTab()
    this.updateCheckInDateDisplay() // 新增：显示打卡日期
  }

  updateCheckInTab() {
    // Populate device types
    const deviceGrid = document.getElementById("device-grid")
    deviceGrid.innerHTML = ""

    this.config.deviceTypes.forEach((device) => {
      const deviceElement = document.createElement("div")
      deviceElement.className = "device-option"
      deviceElement.dataset.deviceId = device.id
      deviceElement.innerHTML = `
                <span class="icon">${device.icon}</span>
                <span class="name">${device.name}</span>
            `
      deviceElement.addEventListener("click", () => this.selectDevice(device.id))
      deviceGrid.appendChild(deviceElement)
    })

    // Populate body areas
    const areaGrid = document.getElementById("area-grid")
    areaGrid.innerHTML = ""

    this.config.bodyAreas.forEach((area) => {
      const areaElement = document.createElement("div")
      areaElement.className = "area-option"
      areaElement.dataset.areaId = area.id
      areaElement.innerHTML = `
                <span class="icon">${area.icon}</span>
                <span class="name">${area.name}</span>
            `
      areaElement.addEventListener("click", () => this.selectArea(area.id))
      areaGrid.appendChild(areaElement)
    })
  }

  selectDevice(deviceId) {
    document.querySelectorAll(".device-option").forEach((option) => {
      option.classList.remove("selected")
    })
    document.querySelector(`[data-device-id="${deviceId}"]`).classList.add("selected")
  }

  selectArea(areaId) {
    document.querySelectorAll(".area-option").forEach((option) => {
      option.classList.remove("selected")
    })
    document.querySelector(`[data-area-id="${areaId}"]`).classList.add("selected")
  }

  async handleCheckIn() {
    const selectedDevice = document.querySelector(".device-option.selected")
    const selectedArea = document.querySelector(".area-option.selected")
    const intensity = document.getElementById("intensity").value
    const notes = document.getElementById("checkin-notes").value.trim()
    if (!selectedDevice || !selectedArea) {
      alert("请选择设备类型和身体部位")
      return
    }
    this.showLoading() // 新增loading
    // 用补卡日期或今天
    const checkInDate = this.selectedCheckInDate ? new Date(this.selectedCheckInDate) : new Date()
    const checkInDayStr = checkInDate.toDateString()
    // 检查该日打卡上限
    const dayCheckIns = this.checkIns.filter(
      (c) => c.userId === this.currentUser.id && new Date(c.timestamp).toDateString() === checkInDayStr,
    ).length
    if (dayCheckIns >= this.config.maxCheckInsPerDay) {
      this.hideLoading()
      alert(`每日最多可打卡 ${this.config.maxCheckInsPerDay} 次`)
      return
    }
    // 处理照片
    let photo = ""
    const checkinPhotoInput = document.getElementById("checkin-photo")
    if (checkinPhotoInput && checkinPhotoInput.dataset.base64) {
      photo = checkinPhotoInput.dataset.base64
    }
    const checkIn = {
      id: Date.now().toString(),
      userId: this.currentUser.id,
      deviceType: selectedDevice.dataset.deviceId,
      bodyArea: selectedArea.dataset.areaId,
      intensity: Number.parseInt(intensity),
      notes,
      photo,
      timestamp: new Date(
        checkInDate.getFullYear(),
        checkInDate.getMonth(),
        checkInDate.getDate(),
        new Date().getHours(),
        new Date().getMinutes(),
        new Date().getSeconds(),
      ).toISOString(),
    }
    this.checkIns.push(checkIn)
    await this.saveToGitee(this.config.checkInDataPath, this.checkIns)
    // 重置表单和补卡日期
    document.querySelectorAll(".device-option, .area-option").forEach((option) => {
      option.classList.remove("selected")
    })
    document.getElementById("intensity").value = 3
    document.getElementById("intensity-value").textContent = "3"
    document.getElementById("checkin-notes").value = ""
    this.selectedCheckInDate = null
    this.updateCheckInDateDisplay()
    // Show success modal
    this.showModal("success-modal")
    // Update UI
    this.updateUI()
    if (this.currentTab === 'history') this.updateHistoryDisplay() // 新增：刷新历史
    this.hideLoading() // 隐藏loading
  }

  updateHistoryDisplay() {
    const filter = document.getElementById("history-filter").value
    const historyList = document.getElementById("history-list")

    let filteredCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)

    // Apply filter
    const now = new Date()
    switch (filter) {
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        filteredCheckIns = filteredCheckIns.filter((c) => new Date(c.timestamp) >= weekAgo)
        break
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        filteredCheckIns = filteredCheckIns.filter((c) => new Date(c.timestamp) >= monthAgo)
        break
    }

    // Sort by timestamp (newest first)
    filteredCheckIns.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    historyList.innerHTML = ""

    if (filteredCheckIns.length === 0) {
      historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无打卡记录</p>'
      return
    }

    filteredCheckIns.forEach((checkIn) => {
      const date = new Date(checkIn.timestamp)
      const device = this.config.deviceTypes.find((d) => d.id === checkIn.deviceType)
      const area = this.config.bodyAreas.find((a) => a.id === checkIn.bodyArea)

      const historyItem = document.createElement("div")
      historyItem.className = "history-item"
      historyItem.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-date">${date.toLocaleDateString("zh-CN")}</span>
                    <span class="history-item-time">${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div class="history-item-details">
                    <div class="history-detail">
                        <i class="fas fa-cog"></i>
                        <span>${device ? device.name : "未知设备"}</span>
                    </div>
                    <div class="history-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${area ? area.name : "未知部位"}</span>
                    </div>
                    <div class="history-detail">
                        <i class="fas fa-bolt"></i>
                        <span>强度 ${checkIn.intensity}</span>
                    </div>
                </div>
                ${checkIn.notes ? `<div class="history-item-notes">${checkIn.notes}</div>` : ""}
            `
      // 新增：点击弹出详情弹窗（只展示该条记录）
      historyItem.addEventListener("click", () => {
        this.showDayDetails(date.getFullYear(), date.getMonth(), date.getDate(), [checkIn])
      })
      historyList.appendChild(historyItem)
    })
  }

  updateStatsDisplay() {
    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)

    // Total check-ins
    document.getElementById("total-checkins").textContent = userCheckIns.length

    // Calculate streak
    const streak = this.calculateStreak(userCheckIns)
    document.getElementById("streak-days").textContent = streak

    // Most used device
    const deviceCounts = {}
    userCheckIns.forEach((c) => {
      deviceCounts[c.deviceType] = (deviceCounts[c.deviceType] || 0) + 1
    })
    const favoriteDevice = Object.keys(deviceCounts).reduce(
      (a, b) => (deviceCounts[a] > deviceCounts[b] ? a : b),
      Object.keys(deviceCounts)[0],
    )
    const favoriteDeviceName = favoriteDevice
      ? this.config.deviceTypes.find((d) => d.id === favoriteDevice)?.name || "-"
      : "-"
    document.getElementById("favorite-device").textContent = favoriteDeviceName

    // Most treated area
    const areaCounts = {}
    userCheckIns.forEach((c) => {
      areaCounts[c.bodyArea] = (areaCounts[c.bodyArea] || 0) + 1
    })
    const favoriteArea = Object.keys(areaCounts).reduce(
      (a, b) => (areaCounts[a] > areaCounts[b] ? a : b),
      Object.keys(areaCounts)[0],
    )
    const favoriteAreaName = favoriteArea ? this.config.bodyAreas.find((a) => a.id === favoriteArea)?.name || "-" : "-"
    document.getElementById("favorite-area").textContent = favoriteAreaName

    // Monthly progress
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthCheckIns = userCheckIns.filter((c) => new Date(c.timestamp) >= monthStart)
    const uniqueDays = new Set(monthCheckIns.map((c) => new Date(c.timestamp).toDateString())).size

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const progressPercent = (uniqueDays / daysInMonth) * 100

    document.getElementById("month-progress").style.width = `${progressPercent}%`
    document.getElementById("progress-text").textContent = `本月已打卡 ${uniqueDays} 天`

    // Update charts
    this.updateFrequencyChart()
    this.updateDeviceChart()
    this.updateAreaChart()
    this.updateIntensityChart()
    this.updateWeeklyHeatmap()
  }

  calculateStreak(checkIns) {
    if (checkIns.length === 0) return 0

    const dates = [...new Set(checkIns.map((c) => new Date(c.timestamp).toDateString()))].sort()
    let streak = 1
    let currentStreak = 1

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1])
      const currentDate = new Date(dates[i])
      const diffDays = (currentDate - prevDate) / (1000 * 60 * 60 * 24)

      if (diffDays === 1) {
        currentStreak++
        streak = Math.max(streak, currentStreak)
      } else {
        currentStreak = 1
      }
    }

    return streak
  }

  updateProfileTab() {
    if (this.currentUser.settings) {
      document.getElementById("reminder-enabled").checked = this.currentUser.settings.reminderEnabled
      document.getElementById("reminder-time").value = this.currentUser.settings.reminderTime
    }
  }

  showAdminPanel() {
    if (!this.currentUser.isAdmin) return

    // Update users list
    const usersList = document.getElementById("users-list")
    usersList.innerHTML = ""

    this.users.forEach((user) => {
      const userItem = document.createElement("div")
      userItem.className = "user-item"
      userItem.innerHTML = `
                <span>${user.username}</span>
                <span>注册时间: ${new Date(user.createdAt).toLocaleDateString("zh-CN")}</span>
            `
      usersList.appendChild(userItem)
    })

    // Update stats
    document.getElementById("total-users").textContent = this.users.length

    const today = new Date().toDateString()
    const todayCheckIns = this.checkIns.filter((c) => new Date(c.timestamp).toDateString() === today).length
    document.getElementById("today-checkins").textContent = todayCheckIns

    this.showModal("admin-panel")
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.add("active")
  }

  closeModal(modal) {
    modal.classList.remove("active")
  }

  exportData() {
    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)
    const data = {
      user: this.currentUser,
      checkIns: userCheckIns,
      exportDate: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hair-removal-data-${this.currentUser.username}-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async clearData() {
    if (confirm("确定要清空所有打卡数据吗？此操作不可恢复！")) {
      this.checkIns = this.checkIns.filter((c) => c.userId !== this.currentUser.id)
      await this.saveToGitee(this.config.checkInDataPath, this.checkIns)
      alert("数据已清空")
      this.updateUI()
    }
  }

  // Calendar methods
  changeMonth(direction) {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + direction)
    this.updateCalendarDisplay()
  }

  toggleView(view) {
    this.currentView = view

    // Update buttons
    document.querySelectorAll(".view-btn").forEach((btn) => btn.classList.remove("active"))
    document.getElementById(`${view}-view-btn`).classList.add("active")

    // Update display
    const calendarContainer = document.querySelector(".calendar-container")
    const historyList = document.getElementById("history-list")

    if (view === "calendar") {
      calendarContainer.style.display = "block"
      historyList.style.display = "none"
      this.updateCalendarDisplay()
    } else {
      calendarContainer.style.display = "none"
      historyList.style.display = "block"
      this.updateHistoryDisplay()
    }
  }

  updateCalendarDisplay() {
    const year = this.currentCalendarDate.getFullYear()
    const month = this.currentCalendarDate.getMonth()

    // Update header
    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    document.getElementById("calendar-month-year").textContent = `${year}年${monthNames[month]}`

    // Get calendar data
    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)
    const monthCheckIns = userCheckIns.filter((c) => {
      const checkInDate = new Date(c.timestamp)
      return checkInDate.getFullYear() === year && checkInDate.getMonth() === month
    })

    // Group check-ins by date
    const checkInsByDate = {}
    monthCheckIns.forEach((checkIn) => {
      const dateKey = new Date(checkIn.timestamp).getDate()
      if (!checkInsByDate[dateKey]) {
        checkInsByDate[dateKey] = []
      }
      checkInsByDate[dateKey].push(checkIn)
    })

    // Generate calendar grid
    const calendarGrid = document.getElementById("calendar-grid")
    calendarGrid.innerHTML = ""

    // Add day headers
    const dayHeaders = ["日", "一", "二", "三", "四", "五", "六"]
    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement("div")
      dayHeader.className = "calendar-day-header"
      dayHeader.textContent = day
      calendarGrid.appendChild(dayHeader)
    })

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement("div")
      emptyDay.className = "calendar-day other-month"
      calendarGrid.appendChild(emptyDay)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement("div")
      dayElement.className = "calendar-day"
      dayElement.textContent = day

      const checkInsForDay = checkInsByDate[day] || []
      const checkInCount = checkInsForDay.length

      // Add styling based on check-in count
      if (checkInCount === 0) {
        dayElement.classList.add("no-checkin")
      } else if (checkInCount === 1) {
        dayElement.classList.add("single-checkin")
      } else {
        dayElement.classList.add("multiple-checkin")

        // Add count badge for multiple check-ins
        const countBadge = document.createElement("div")
        countBadge.className = "calendar-day-count"
        countBadge.textContent = checkInCount
        dayElement.appendChild(countBadge)
      }

      // Highlight today
      if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
        dayElement.classList.add("today")
      }
      // 事件绑定优化
      dayElement.addEventListener("click", () => this.showDayDetails(year, month, day, checkInsForDay))
      // PC端悬停显示tooltip
      if (!this.isMobile()) {
        dayElement.addEventListener("mouseenter", (e) => this.showCalendarTooltip(e, day, checkInsForDay))
        dayElement.addEventListener("mouseleave", () => this.hideCalendarTooltip())
      } else {
        // 移动端长按显示tooltip
        let pressTimer = null
        dayElement.addEventListener("touchstart", (e) => {
          pressTimer = setTimeout(() => {
            this.showCalendarTooltip(e, day, checkInsForDay, true)
          }, 500)
        })
        dayElement.addEventListener("touchend", () => {
          clearTimeout(pressTimer)
          this.hideCalendarTooltip()
        })
        dayElement.addEventListener("touchmove", () => {
          clearTimeout(pressTimer)
          this.hideCalendarTooltip()
        })
      }
      calendarGrid.appendChild(dayElement)
    }
  }
  // 判断是否移动端
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }
  showCalendarTooltip(event, day, checkIns, isTouch = false) {
    // 如果详情modal已弹出，不显示tooltip
    if (document.getElementById("checkin-detail-modal").classList.contains("active")) return
    const tooltip = document.createElement("div")
    tooltip.className = "calendar-tooltip"
    if (checkIns.length === 0) {
      tooltip.textContent = `${day}日 - 未打卡`
    } else {
      const devices = checkIns
        .map((c) => {
          const device = this.config.deviceTypes.find((d) => d.id === c.deviceType)
          return device ? device.name : "未知设备"
        })
        .join(", ")
      tooltip.textContent = `${day}日 - ${checkIns.length}次打卡 (${devices})`
    }
    document.body.appendChild(tooltip)
    let rect
    if (isTouch && event.touches && event.touches[0]) {
      rect = { left: event.touches[0].clientX, top: event.touches[0].clientY, width: 0, height: 0 }
    } else {
      rect = event.target.getBoundingClientRect()
    }
    tooltip.style.left = `${rect.left + (rect.width || 0) / 2}px`
    tooltip.style.top = `${rect.top - 35}px`
    tooltip.style.transform = "translateX(-50%)"
    setTimeout(() => tooltip.classList.add("show"), 10)
  }

  hideCalendarTooltip() {
    const tooltip = document.querySelector(".calendar-tooltip")
    if (tooltip) {
      tooltip.remove()
    }
  }

  showDayDetails(year, month, day, checkIns) {
    // 判断当前是否日历视图
    const isCalendarView = this.currentTab === 'history' && this.currentView === 'calendar'
    if (isCalendarView) {
      // 日历视图弹现代化弹窗，无编辑删除
      const modal = document.getElementById("calendar-detail-modal")
      const list = document.getElementById("calendar-detail-list")
      const title = document.getElementById("calendar-detail-title")
      title.textContent = `${year}年${month + 1}月${day}日的打卡详情`
      list.innerHTML = ""
      if (checkIns.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">暂无打卡记录</p>'
      } else {
        checkIns.forEach((c) => {
          const device = this.config.deviceTypes.find((d) => d.id === c.deviceType)
          const area = this.config.bodyAreas.find((a) => a.id === c.bodyArea)
          const icon = device ? device.icon : '✨'
          const time = new Date(c.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
          list.innerHTML += `
            <div class="calendar-detail-card">
              <div class="icon">${icon}</div>
              <div class="info">
                <div class="time"><i class='fas fa-clock'></i> ${time}</div>
                <div><span class="device"><i class='fas fa-cog'></i> ${device ? device.name : '未知设备'}</span>
                <span class="area"><i class='fas fa-map-marker-alt'></i> ${area ? area.name : '未知部位'}</span>
                <span class="intensity"><i class='fas fa-bolt'></i> 强度${c.intensity}</span></div>
                ${c.notes ? `<div class="notes"><i class='fas fa-comment-dots'></i> ${c.notes}</div>` : ""}
                ${c.photo ? `<div class='photo-preview'><img src='${c.photo}' alt='打卡照片' style='cursor:pointer;'></div>` : ""}
              </div>
            </div>
          `
        })
      }
      // 新增：图片点击预览
      setTimeout(() => {
        document.querySelectorAll('#calendar-detail-list .photo-preview img').forEach(img => {
          img.addEventListener('click', (e) => {
            const src = img.getAttribute('src')
            const modal = document.getElementById('photo-preview-modal')
            const modalImg = document.getElementById('photo-preview-img')
            modalImg.src = src
            this.showModal('photo-preview-modal')
            e.stopPropagation()
          })
        })
      }, 0)
      this.showModal("calendar-detail-modal")
      return
    }
    // 列表视图弹原有弹窗（含编辑删除）
    const modal = document.getElementById("checkin-detail-modal")
    const list = document.getElementById("checkin-detail-list")
    const title = document.getElementById("checkin-detail-title")
    title.textContent = `${year}年${month + 1}月${day}日的打卡详情`
    list.innerHTML = ""
    if (checkIns.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">暂无打卡记录</p>'
    } else {
      checkIns.forEach((c) => {
        const device = this.config.deviceTypes.find((d) => d.id === c.deviceType)?.name || "未知设备"
        const area = this.config.bodyAreas.find((a) => a.id === c.bodyArea)?.name || "未知部位"
        const time = new Date(c.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        const item = document.createElement("div")
        item.className = "checkin-detail-item"
        item.innerHTML = `
          <div><b>${time}</b> - ${device} - ${area} - 强度${c.intensity}</div>
          <div style="color:#888;font-size:13px;">${c.notes ? c.notes : ""}</div>
          ${c.photo ? `<div class='photo-preview'><img src='${c.photo}' alt='打卡照片'></div>` : ""}
          <div style="margin-top:6px;">
            <button class="btn-secondary btn-edit" data-id="${c.id}">编辑</button>
            <button class="btn-danger btn-delete" data-id="${c.id}">删除</button>
          </div>
        `
        list.appendChild(item)
      })
    }
    // 按钮事件
    list.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = btn.dataset.id
        this.deleteCheckIn(id)
      })
    })
    list.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = btn.dataset.id
        this.showEditCheckInModal(id)
      })
    })
    this.showModal("checkin-detail-modal")
  }

  showRecheckinCalendarModal() {
    this.recheckinCalendarDate = new Date()
    this.updateRecheckinCalendarDisplay()
    this.showModal("recheckin-calendar-modal")
  }
  changeRecheckinMonth(direction) {
    this.recheckinCalendarDate.setMonth(this.recheckinCalendarDate.getMonth() + direction)
    this.updateRecheckinCalendarDisplay()
  }
  updateRecheckinCalendarDisplay() {
    const year = this.recheckinCalendarDate.getFullYear()
    const month = this.recheckinCalendarDate.getMonth()
    // 更新header
    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    document.getElementById("recheckin-calendar-month-year").textContent = `${year}年${monthNames[month]}`
    // 获取本用户本月打卡
    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)
    const monthCheckIns = userCheckIns.filter((c) => {
      const checkInDate = new Date(c.timestamp)
      return checkInDate.getFullYear() === year && checkInDate.getMonth() === month
    })
    // 按天分组
    const checkInsByDate = {}
    monthCheckIns.forEach((checkIn) => {
      const dateKey = new Date(checkIn.timestamp).getDate()
      if (!checkInsByDate[dateKey]) checkInsByDate[dateKey] = []
      checkInsByDate[dateKey].push(checkIn)
    })
    // 生成日历
    const calendarGrid = document.getElementById("recheckin-calendar-grid")
    calendarGrid.innerHTML = ""
    // 星期头
    const dayHeaders = ["日", "一", "二", "三", "四", "五", "六"]
    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement("div")
      dayHeader.className = "calendar-day-header"
      dayHeader.textContent = day
      calendarGrid.appendChild(dayHeader)
    })
    // 月首空格
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement("div")
      emptyDay.className = "calendar-day other-month"
      calendarGrid.appendChild(emptyDay)
    }
    // 日期格
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement("div")
      dayElement.className = "calendar-day"
      dayElement.textContent = day
      // 已有打卡样式
      const checkInCount = (checkInsByDate[day] || []).length
      if (checkInCount === 0) dayElement.classList.add("no-checkin")
      else if (checkInCount === 1) dayElement.classList.add("single-checkin")
      else dayElement.classList.add("multiple-checkin")
      // 选中补卡日期
      if (this.selectedCheckInDate) {
        const d = this.selectedCheckInDate
        if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
          dayElement.classList.add("selected")
        }
      }
      // 点击选择补卡日期
      dayElement.addEventListener("click", () => {
        this.selectedCheckInDate = new Date(year, month, day)
        this.closeModal(document.getElementById("recheckin-calendar-modal"))
        this.updateCheckInDateDisplay()
      })
      calendarGrid.appendChild(dayElement)
    }
  }
  updateCheckInDateDisplay() {
    // 打卡表单显示当前打卡日期
    const dateSpan = document.getElementById("current-date")
    if (this.selectedCheckInDate) {
      dateSpan.textContent = this.selectedCheckInDate.toLocaleDateString("zh-CN") + "（补卡）"
      dateSpan.classList.add("recheckin")
    } else {
      dateSpan.textContent = new Date().toLocaleDateString("zh-CN")
      dateSpan.classList.remove("recheckin")
    }
  }

  // Chart methods
  updateFrequencyChart() {
    const canvas = document.getElementById("frequency-chart")
    const ctx = canvas.getContext("2d")

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)

    // Get last 30 days data
    const last30Days = []
    const today = new Date()

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toDateString()

      const dayCheckIns = userCheckIns.filter((c) => new Date(c.timestamp).toDateString() === dateStr).length

      last30Days.push({
        date: date.getDate(),
        count: dayCheckIns,
      })
    }

    // Draw chart
    const padding = 40
    const chartWidth = canvas.width - padding * 2
    const chartHeight = canvas.height - padding * 2
    const maxCount = Math.max(...last30Days.map((d) => d.count), 1)

    // Draw axes
    ctx.strokeStyle = "#ddd"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, canvas.height - padding)
    ctx.lineTo(canvas.width - padding, canvas.height - padding)
    ctx.stroke()

    // Draw data line
    ctx.strokeStyle = "#667eea"
    ctx.lineWidth = 3
    ctx.beginPath()

    last30Days.forEach((day, index) => {
      const x = padding + (index / (last30Days.length - 1)) * chartWidth
      const y = canvas.height - padding - (day.count / maxCount) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      // Draw data points
      ctx.fillStyle = "#667eea"
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()
    })

    ctx.stroke()

    // Draw labels
    ctx.fillStyle = "#666"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"

    // Y-axis labels
    for (let i = 0; i <= maxCount; i++) {
      const y = canvas.height - padding - (i / maxCount) * chartHeight
      ctx.fillText(i.toString(), padding - 20, y + 4)
    }

    // X-axis labels (show every 5 days)
    last30Days.forEach((day, index) => {
      if (index % 5 === 0) {
        const x = padding + (index / (last30Days.length - 1)) * chartWidth
        ctx.fillText(day.date.toString(), x, canvas.height - padding + 20)
      }
    })
  }

  updateDeviceChart() {
    const canvas = document.getElementById("device-chart")
    const ctx = canvas.getContext("2d")

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)

    // Count device usage
    const deviceCounts = {}
    userCheckIns.forEach((c) => {
      deviceCounts[c.deviceType] = (deviceCounts[c.deviceType] || 0) + 1
    })

    const devices = Object.keys(deviceCounts)
    if (devices.length === 0) {
      ctx.fillStyle = "#666"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("暂无数据", canvas.width / 2, canvas.height / 2)
      return
    }

    // Draw pie chart
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 40
    const total = Object.values(deviceCounts).reduce((a, b) => a + b, 0)

    const colors = ["#667eea", "#4ecdc4", "#ff6b6b", "#ffd93d", "#6bcf7f"]
    let currentAngle = -Math.PI / 2

    devices.forEach((deviceId, index) => {
      const count = deviceCounts[deviceId]
      const sliceAngle = (count / total) * 2 * Math.PI

      // Draw slice
      ctx.fillStyle = colors[index % colors.length]
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      ctx.closePath()
      ctx.fill()

      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2
      const labelX = centerX + Math.cos(labelAngle) * (radius + 20)
      const labelY = centerY + Math.sin(labelAngle) * (radius + 20)

      const device = this.config.deviceTypes.find((d) => d.id === deviceId)
      const deviceName = device ? device.name : deviceId
      const percentage = ((count / total) * 100).toFixed(1)

      ctx.fillStyle = "#333"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(`${deviceName}`, labelX, labelY)
      ctx.fillText(`${percentage}%`, labelX, labelY + 15)

      currentAngle += sliceAngle
    })
  }

  updateAreaChart() {
    const canvas = document.getElementById("area-chart")
    const ctx = canvas.getContext("2d")

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)

    // Count area usage
    const areaCounts = {}
    userCheckIns.forEach((c) => {
      areaCounts[c.bodyArea] = (areaCounts[c.bodyArea] || 0) + 1
    })

    const areas = Object.keys(areaCounts)
    if (areas.length === 0) {
      ctx.fillStyle = "#666"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("暂无数据", canvas.width / 2, canvas.height / 2)
      return
    }

    // Draw bar chart
    const padding = 60
    const chartWidth = canvas.width - padding * 2
    const chartHeight = canvas.height - padding * 2
    const maxCount = Math.max(...Object.values(areaCounts))
    const barWidth = (chartWidth / areas.length) * 0.8
    const barSpacing = (chartWidth / areas.length) * 0.2

    areas.forEach((areaId, index) => {
      const count = areaCounts[areaId]
      const barHeight = (count / maxCount) * chartHeight
      const x = padding + index * (barWidth + barSpacing) + barSpacing / 2
      const y = canvas.height - padding - barHeight

      // Draw bar
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
      gradient.addColorStop(0, "#667eea")
      gradient.addColorStop(1, "#764ba2")

      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth, barHeight)

      // Draw value on top
      ctx.fillStyle = "#333"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(count.toString(), x + barWidth / 2, y - 5)

      // Draw area name
      const area = this.config.bodyAreas.find((a) => a.id === areaId)
      const areaName = area ? area.name : areaId
      ctx.save()
      ctx.translate(x + barWidth / 2, canvas.height - padding + 20)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(areaName, 0, 0)
      ctx.restore()
    })

    // Draw Y-axis labels
    ctx.fillStyle = "#666"
    ctx.font = "12px Arial"
    ctx.textAlign = "right"

    for (let i = 0; i <= maxCount; i += Math.ceil(maxCount / 5)) {
      const y = canvas.height - padding - (i / maxCount) * chartHeight
      ctx.fillText(i.toString(), padding - 10, y + 4)
    }
  }

  updateIntensityChart() {
    const canvas = document.getElementById("intensity-chart")
    const ctx = canvas.getContext("2d")

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)

    if (userCheckIns.length === 0) {
      ctx.fillStyle = "#666"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("暂无数据", canvas.width / 2, canvas.height / 2)
      return
    }

    // Get intensity trend over time (last 30 check-ins)
    const recentCheckIns = userCheckIns.slice(-30)

    // Draw line chart
    const padding = 40
    const chartWidth = canvas.width - padding * 2
    const chartHeight = canvas.height - padding * 2

    // Draw axes
    ctx.strokeStyle = "#ddd"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, canvas.height - padding)
    ctx.lineTo(canvas.width - padding, canvas.height - padding)
    ctx.stroke()

    // Draw intensity line
    ctx.strokeStyle = "#4ecdc4"
    ctx.lineWidth = 3
    ctx.beginPath()

    recentCheckIns.forEach((checkIn, index) => {
      const x = padding + (index / (recentCheckIns.length - 1)) * chartWidth
      const y = canvas.height - padding - ((checkIn.intensity - 1) / 4) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      // Draw data points
      ctx.fillStyle = "#4ecdc4"
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })

    ctx.stroke()

    // Draw labels
    ctx.fillStyle = "#666"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"

    // Y-axis labels (intensity levels)
    for (let i = 1; i <= 5; i++) {
      const y = canvas.height - padding - ((i - 1) / 4) * chartHeight
      ctx.textAlign = "right"
      ctx.fillText(i.toString(), padding - 10, y + 4)
    }

    // X-axis label
    ctx.textAlign = "center"
    ctx.fillText("最近30次打卡", canvas.width / 2, canvas.height - 10)
  }

  updateWeeklyHeatmap() {
    const container = document.getElementById("weekly-heatmap")
    container.innerHTML = ""
    const userCheckIns = this.checkIns.filter((c) => c.userId === this.currentUser.id)
    // Create days labels
    const daysContainer = document.createElement("div")
    daysContainer.className = "heatmap-days"
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"]
    dayNames.forEach((day) => {
      const dayElement = document.createElement("div")
      dayElement.textContent = day
      daysContainer.appendChild(dayElement)
    })
    container.appendChild(daysContainer)
    // Create heatmap grid
    const gridContainer = document.createElement("div")
    gridContainer.className = "heatmap-grid"
    // Get last 12 weeks of data
    const weeks = 12
    const today = new Date()
    // 计算今天是周几（0=周日）
    const todayDay = today.getDay()
    // 计算本周日的日期
    const thisSunday = new Date(today)
    thisSunday.setDate(today.getDate() - todayDay)
    for (let week = weeks - 1; week >= 0; week--) {
      const weekContainer = document.createElement("div")
      weekContainer.className = "heatmap-week"
      for (let day = 0; day < 7; day++) {
        // 计算当前格子的日期
        const date = new Date(thisSunday)
        date.setDate(thisSunday.getDate() - (weeks - 1 - week) * 7 + day)
        const dateStr = date.toDateString()
        const dayCheckIns = userCheckIns.filter((c) => new Date(c.timestamp).toDateString() === dateStr).length
        const cell = document.createElement("div")
        cell.className = "heatmap-cell"
        // Determine intensity level (0-4)
        let level = 0
        if (dayCheckIns > 0) level = 1
        if (dayCheckIns > 1) level = 2
        if (dayCheckIns > 2) level = 3
        if (dayCheckIns > 3) level = 4
        cell.classList.add(`level-${level}`)
        cell.title = `${date.toLocaleDateString("zh-CN")}: ${dayCheckIns}次打卡`
        weekContainer.appendChild(cell)
      }
      gridContainer.appendChild(weekContainer)
    }
    container.appendChild(gridContainer)
  }

  // 新增：删除打卡记录
  async deleteCheckIn(id) {
    if (!confirm("确定要删除这条打卡记录吗？")) return
    this.showLoading() // 新增loading
    this.checkIns = this.checkIns.filter((c) => c.id !== id)
    await this.saveToGitee(this.config.checkInDataPath, this.checkIns)
    this.closeModal(document.getElementById("checkin-detail-modal"))
    this.updateUI()
    if (this.currentTab === 'history') this.updateHistoryDisplay() // 新增：刷新历史
    this.hideLoading() // 隐藏loading
  }
  // 新增：编辑打卡记录弹窗
  showEditCheckInModal(id) {
    const checkIn = this.checkIns.find((c) => c.id === id)
    if (!checkIn) return
    // 填充设备卡片
    const deviceGrid = document.getElementById("edit-device-grid")
    deviceGrid.innerHTML = ""
    this.config.deviceTypes.forEach((device) => {
      const deviceElement = document.createElement("div")
      deviceElement.className = "device-option"
      deviceElement.dataset.deviceId = device.id
      deviceElement.innerHTML = `<span class='icon'>${device.icon}</span><span class='name'>${device.name}</span>`
      if (checkIn.deviceType === device.id) deviceElement.classList.add("selected")
      deviceElement.addEventListener("click", () => {
        deviceGrid.querySelectorAll(".device-option").forEach(opt => opt.classList.remove("selected"))
        deviceElement.classList.add("selected")
      })
      deviceGrid.appendChild(deviceElement)
    })
    // 填充部位卡片
    const areaGrid = document.getElementById("edit-area-grid")
    areaGrid.innerHTML = ""
    this.config.bodyAreas.forEach((area) => {
      const areaElement = document.createElement("div")
      areaElement.className = "area-option"
      areaElement.dataset.areaId = area.id
      areaElement.innerHTML = `<span class='icon'>${area.icon}</span><span class='name'>${area.name}</span>`
      if (checkIn.bodyArea === area.id) areaElement.classList.add("selected")
      areaElement.addEventListener("click", () => {
        areaGrid.querySelectorAll(".area-option").forEach(opt => opt.classList.remove("selected"))
        areaElement.classList.add("selected")
      })
      areaGrid.appendChild(areaElement)
    })
    // 强度
    document.getElementById("edit-intensity").value = checkIn.intensity
    document.getElementById("edit-intensity-value").textContent = checkIn.intensity
    // 备注
    document.getElementById("edit-notes").value = checkIn.notes || ""
    // 预览照片
    const editPhotoInput = document.getElementById("edit-photo")
    const editPhotoPreview = document.getElementById("edit-photo-preview")
    if (checkIn.photo) {
      editPhotoPreview.innerHTML = `<img src='${checkIn.photo}' alt='打卡照片'>`
      editPhotoInput.dataset.base64 = checkIn.photo
    } else {
      editPhotoPreview.innerHTML = ""
      editPhotoInput.dataset.base64 = ""
    }
    document.getElementById("edit-checkin-form").dataset.id = id
    this.showModal("edit-checkin-modal")
  }
  // 新增：编辑表单提交
  async handleEditCheckInSubmit(e) {
    e.preventDefault()
    this.showLoading() // 新增loading
    const id = document.getElementById("edit-checkin-form").dataset.id
    const checkIn = this.checkIns.find((c) => c.id === id)
    if (!checkIn) { this.hideLoading(); return }
    // 设备
    const selectedDevice = document.querySelector("#edit-device-grid .device-option.selected")
    if (selectedDevice) checkIn.deviceType = selectedDevice.dataset.deviceId
    // 部位
    const selectedArea = document.querySelector("#edit-area-grid .area-option.selected")
    if (selectedArea) checkIn.bodyArea = selectedArea.dataset.areaId
    // 强度
    checkIn.intensity = parseInt(document.getElementById("edit-intensity").value)
    // 备注
    checkIn.notes = document.getElementById("edit-notes").value.trim()
    // 照片
    const editPhotoInput = document.getElementById("edit-photo")
    if (editPhotoInput && editPhotoInput.dataset.base64) {
      checkIn.photo = editPhotoInput.dataset.base64
    }
    await this.saveToGitee(this.config.checkInDataPath, this.checkIns)
    this.closeModal(document.getElementById("edit-checkin-modal"))
    this.closeModal(document.getElementById("checkin-detail-modal"))
    this.updateUI()
    if (this.currentTab === 'history') this.updateHistoryDisplay() // 新增：刷新历史
    this.hideLoading() // 隐藏loading
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new HairRemovalApp()
})
