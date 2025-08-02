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

  getHistoryRecords() {
    this.log("获取历史记录")

    const sortedRecords = [...this.database.records].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )
    console.log("排序结束")
    if (this.logEnabled && sortedRecords.length > 0) {
      // console.groupCollapsed(`[DB] 获取的历史记录 (共 ${sortedRecords.length} 条)`)
      sortedRecords.forEach((record, index) => {
        console.log(
          `%c${record.date}%c: ${record.total}分钟, ${record.sessions.length}个会话`,
          "color:#1E88E5; font-weight:bold",
          ""
        )

        // 按需展开会话详情
        // console.groupCollapsed(`会话详情`)
        record.sessions.forEach((session, sessionIndex) => {
          console.log(
            `会话${sessionIndex + 1}: ${session.startTime}-${session.endTime} ` +
              `(${session.duration}分钟, ${session.mode})`
          )
        })
        // console.groupEnd()
      })
      // console.groupEnd() // 外层分组结束
    } else if (this.logEnabled) {
      console.log("[DB] 暂无历史记录")
    }

    return sortedRecords
  }

  getStatistics() {
    this.log("获取统计信息", this.database?.statistics || null)

    // 如果数据库未初始化，返回空统计数据
    if (!this.database) {
      console.warn("[DB] 警告: 数据库尚未初始化，返回空统计信息")
      return {
        totalMinutes: 0,
        recordDays: 0,
        dailyAverage: 0,
        longestStreak: 0
      }
    }

    // 直接返回当前统计信息
    return {...this.database.statistics} // 使用展开操作符创建副本
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

   /**
   * 重置数据库（清空所有数据）
   */
   async resetDatabase() {
    try {
      this.log("开始重置数据库...");
      
      // 创建全新的初始数据结构
      this.database = {
        version: 1.0,
        records: [],
        statistics: {
          totalMinutes: 0,
          recordDays: 0,
          dailyAverage: 0,
          longestStreak: 0
        }
      };

      // 保存重置后的数据库
      await this.save();
      
      this.log("数据库已重置为初始状态", {
        version: this.database.version,
        records: this.database.records.length
      });

      this.deleteToday()
      
      return true;
    } catch (err) {
      this.error("重置数据库失败", err);
      throw new Error(`数据库重置失败: ${err.message}`);
    }
  }

  deleteToday(){
    storage.delete({
      key: 'todayTotal',
      success: function(data) {
        console.log('今日累计删除')
      },
      fail: function(data, code) {
        console.log("今日累计删除失败")
      }
    })
  }


  
  /**
   * 获取当日专注数据摘要
   * @returns {Object} 包含当日总时长(todayTotal)和专注次数(sessionCount)的对象
   */
  getTodaySummary() {
    // 获取当前日期（YYYY-MM-DD格式）
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.database) {
      this.error("数据库未初始化", new Error("请先调用init()方法初始化数据库"));
      return { todayTotal: 0, sessionCount: 0 };
    }

    this.log(`查询当日专注摘要 ${today}`);

    // 查找当天的记录
    const todayRecord = this.database.records.find(
      record => record.date === today
    );

    if (todayRecord) {
      // 打印调试信息
      this.log(`找到当日记录: ${today}`, {
        total: todayRecord.total,
        sessions: todayRecord.sessions.length
      });
      
      return {
        todayTotal: todayRecord.total,
        sessionCount: todayRecord.sessions.length
      };
    }
    
    this.log(`当日(${today})无专注记录`);
    return { todayTotal: -1, sessionCount: -1 };
  }


    /**
   * 获取指定日期的专注数据摘要
   * @param {string|Date} date - 要查询的日期（字符串格式为YYYY-MM-DD，或Date对象）
   * @returns {Object} 包含总时长(total)和专注次数(sessionCount)的对象
   */
    getDaySummary(date) {
      // 处理日期参数
      let targetDate;
      console.log("检测输入")
      if (typeof date === 'string') {
        console.log("string格式")
        targetDate = date;
      } else if (date instanceof Date) {
        console.log("date格式")
        targetDate = date.toISOString().split('T')[0];
      } else {
        console.log("格式无效")
        this.error("无效日期参数", new Error("参数必须是字符串或Date对象"));
        return { total: 0, sessionCount: 0 };
      }
      
      if (!this.database) {
        this.error("数据库未初始化", new Error("请先调用init()方法初始化数据库"));
        return { total: 0, sessionCount: 0 };
      }
      console.log("查询记录")
  
      this.log(`查询日期: ${targetDate}`);
  
      // 查找指定日期的记录
      const dayRecord = this.database.records.find(
        record => record.date === targetDate
      );
  
      if (dayRecord) {
        this.log(`找到记录: ${targetDate}`, {
          total: dayRecord.total,
          sessions: dayRecord.sessions.length
        });
        
        return {
          total: dayRecord.total,
          sessionCount: dayRecord.sessions.length
        };
      }
      
      this.log(`日期(${targetDate})无专注记录`);
      return { total: 0, sessionCount: 0 };
    }

  // 启用/禁用日志
  setLogging(enabled) {
    this.logEnabled = enabled
    this.log(`日志记录已${enabled ? "启用" : "禁用"}`)
  }
}

// 导出单例实例
export default new FocusDatabase()
