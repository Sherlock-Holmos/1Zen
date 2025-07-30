// src/database/focusDB.js
import storage from "@system.storage"

class FocusDatabase {
  constructor() {
    this.database = null
    this.logEnabled = true // 控制日志开关
  }

  // 日志方法
  log(message, data = null) {
    if (!this.logEnabled) return

    const timestamp = new Date().toLocaleTimeString()
    console.log(`[DB] [${timestamp}] ${message}`)

    if (data) {
      console.log(`[DB] 数据详情: ${JSON.stringify(data, null, 2)}`)
    }
  }

  // 错误日志
  error(message, err) {
    const timestamp = new Date().toLocaleTimeString()
    console.error(`[DB] [ERROR] [${timestamp}] ${message}`, err)
  }

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      this.log("开始初始化数据库...")

      storage.get({
        key: "focusDatabase",
        success: (data) => {
          if (data) {
            this.log("从存储加载数据库")
            this.database = JSON.parse(data)

            // 打印完整数据库状态
            this.log("数据库状态", {
              version: this.database.version,
              records_count: this.database.records.length,
              stats: this.database.statistics
            })

            // 打印每条记录
            this.database.records.forEach((record, index) => {
              this.log(`记录 #${index + 1}`, {
                date: record.date,
                total: record.total,
                sessions_count: record.sessions.length
              })

              // 打印每个会话细节
              record.sessions.forEach((session, sessionIndex) => {
                this.log(`会话 #${sessionIndex + 1}`, {
                  id: session.id,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  duration: session.duration,
                  mode: session.mode
                })
              })
            })

            resolve(this.database)
          } else {
            this.log("首次使用，创建新数据库")
            this.database = {
              version: 1.0,
              records: [],
              statistics: {
                totalMinutes: 0,
                recordDays: 0,
                dailyAverage: 0,
                longestStreak: 0
              }
            }

            // 打印初始状态
            this.log("新数据库状态", this.database)

            this.save().then(resolve).catch(reject)
          }
        },
        fail: (err) => {
          this.error("数据库初始化失败", err)
          reject(err)
        }
      })
    })
  }

  // 保存数据库
  async save() {
    return new Promise((resolve, reject) => {
      this.log("保存数据库...")

      storage.set({
        key: "focusDatabase",
        value: JSON.stringify(this.database),
        success: () => {
          this.log("数据库保存成功", {
            records_count: this.database.records.length,
            stats: this.database.statistics
          })
          resolve()
        },
        fail: (err) => {
          this.error("数据库保存失败", err)
          reject(err)
        }
      })
    })
  }

  // 添加新记录
  async addRecord(record) {
    try {
      this.log("添加新记录", record)

      const today = new Date().toISOString().split("T")[0]
      let found = false

      // 查找当天的记录组
      for (const dayRecord of this.database.records) {
        if (dayRecord.date === today) {
          this.log(`找到当天记录组: ${today}`)
          dayRecord.sessions.push(record)
          dayRecord.total += record.duration
          found = true
          break
        }
      }

      // 如果当天没有记录，创建新组
      if (!found) {
        this.log(`创建新日期组: ${today}`)
        this.database.records.push({
          date: today,
          total: record.duration,
          sessions: [record]
        })
      }

      // 更新统计数据
      this.updateStatistics()

      // 保存数据库
      await this.save()

      this.log("记录添加成功")
      return this.database
    } catch (err) {
      this.error("添加记录失败", err)
      throw err
    }
  }

  // 更新统计信息
  updateStatistics() {
    this.log("更新统计数据...")

    let totalMinutes = 0
    let recordDays = this.database.records.length
    let currentStreak = 0
    let longestStreak = 0

    // 按日期排序记录
    const sortedRecords = [...this.database.records].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    )

    // 计算总时长和最长连续天数
    let prevDate = null
    for (const record of sortedRecords) {
      totalMinutes += record.total

      // 计算连续天数
      const currentDate = new Date(record.date)
      if (prevDate && (currentDate - prevDate) / (1000 * 60 * 60 * 24) === 1) {
        currentStreak++
      } else {
        currentStreak = 1
      }

      if (currentStreak > longestStreak) {
        longestStreak = currentStreak
      }

      prevDate = currentDate
    }

    // 更新统计数据
    const newStats = {
      totalMinutes,
      recordDays,
      dailyAverage: recordDays > 0 ? Math.round(totalMinutes / recordDays) : 0,
      longestStreak
    }

    this.database.statistics = newStats

    // 打印统计更新
    this.log("统计数据已更新", newStats)
  }

  // // 获取历史记录（按日期倒序）
  // getHistoryRecords() {
  //   this.log("获取历史记录")
  //   return [...this.database.records].sort((a, b) => new Date(b.date) - new Date(a.date))
  // }

  getHistoryRecords() {
    this.log("获取历史记录")
    
    // 创建排序后的副本
    const sortedRecords = [...this.database.records].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    )
    
    // 添加控制台打印
    if (this.logEnabled) {
      console.groupCollapsed(`[DB] 获取的历史记录 (共 ${sortedRecords.length} 条)`)
      
      if (sortedRecords.length === 0) {
        console.log("[DB] 暂无历史记录")
      } else {
        sortedRecords.forEach((record, index) => {
          console.groupCollapsed(`记录 #${index + 1}: ${record.date} (总计: ${record.total} 分钟)`)
          console.log(`日期: ${record.date}`)
          console.log(`总专注时长: ${record.total} 分钟`)
          console.log(`会话数量: ${record.sessions.length}`)
          
          console.groupCollapsed(`会话详情`)
          record.sessions.forEach((session, sessionIndex) => {
            console.log(`会话 #${sessionIndex + 1}:`)
            console.log(`  ID: ${session.id}`)
            console.log(`  开始时间: ${session.startTime}`)
            console.log(`  结束时间: ${session.endTime}`)
            console.log(`  时长: ${session.duration} 分钟`)
            console.log(`  模式: ${session.mode}`)
          })
          console.groupEnd() // 会话详情
          
          console.groupEnd() // 单个记录
        })
      }
      
      console.groupEnd() // 所有记录
    }
    
    return sortedRecords
  }

  // 清理旧记录（保留最近30天）
  async cleanupOldRecords() {
    this.log("清理旧记录...")

    const now = new Date()
    const cutoffDate = new Date(now.setDate(now.getDate() - 30)).toISOString().split("T")[0]

    const beforeCount = this.database.records.length

    this.database.records = this.database.records.filter((record) => record.date >= cutoffDate)

    const afterCount = this.database.records.length
    const removedCount = beforeCount - afterCount

    this.log(`清理完成: 保留 ${afterCount} 条记录，删除 ${removedCount} 条旧记录`)

    this.updateStatistics()
    await this.save()

    return this.database
  }

  // 启用/禁用日志
  setLogging(enabled) {
    this.logEnabled = enabled
    this.log(`日志记录已${enabled ? "启用" : "禁用"}`)
  }
}

// 导出单例实例
export default new FocusDatabase()
