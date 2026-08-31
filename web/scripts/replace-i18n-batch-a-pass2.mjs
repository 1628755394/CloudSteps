#!/usr/bin/env node
import fs from "fs";
import path from "path";

const pagesDir = path.join(process.cwd(), "src/pages");
const files = [
  "StudentDetail.tsx", "TrainingRecords.tsx", "CheckIn.tsx", "CreateCoachingAppointment.tsx",
  "WordBookWords.tsx", "CreateCustomWordBook.tsx", "AntiForgetting.tsx", "CoachCompletedSessions.tsx",
  "MyStudents.tsx", "CreateStudent.tsx", "PostTrainingCheck.tsx", "FlashReview.tsx",
  "ReviewWordList.tsx", "CoachCenter.tsx",
];

const replacements = [
  ['`学员 #${row.studentId}`', 't("student_detail.student_fallback", { id: row.studentId })'],
  ['`学员 #${studentId}`', 't("student_detail.student_fallback", { id: studentId })'],
  ['`${Math.max(0, Math.round(n))}分钟`', 't("practice.minutes_unit", { count: Math.max(0, Math.round(n)) })'],
  ['showToast.success("抗遗忘次数已更新")', 'showToast.success(t("student_detail.review_updated"))'],
  ['showToast.error("请输入非负整数分钟")', 'showToast.error(t("student_detail.invalid_minutes"))'],
  ['showToast.success("已添加词库")', 'showToast.success(t("student_detail.added_wordbook"))'],
  ['showToast.success("已移除")', 'showToast.success(t("student_detail.removed_wordbook"))'],
  ['showToast.success("已从名下移除该学员")', 'showToast.success(t("student_detail.removed"))'],
  ['showToast.warning("密码至少 6 位")', 'showToast.warning(t("my_students.password_min"))'],
  ['description="无效的学员"', 'description={t("student_detail.invalid")}'],
  ['aria-label="返回学员管理"', 'aria-label={t("student_detail.back")}'],
  ['>移除<', '>{t("student_detail.remove")}<'],
  ['>课时<', '>{t("student_detail.tab_hours")}<'],
  ['>词库<', '>{t("student_detail.tab_wordbooks")}<'],
  ['>词汇测试<', '>{t("student_detail.tab_vocab")}<'],
  ['description="未找到该学员的陪练额度"', 'description={t("student_detail.not_found_quota")}'],
  ['>剩余课时<', '>{t("student_detail.remaining_hours")}<'],
  ['>配置陪练额度<', '>{t("student_detail.configure_quota")}'],
  ['>追加分钟<', '>{t("student_detail.add_minutes")}<'],
  ['>设为剩余<', '>{t("student_detail.set_remaining")}<'],
  ['label={quotaMode === "add" ? "追加分钟数" : "剩余分钟数"}', 'label={quotaMode === "add" ? t("student_detail.add_minutes_label") : t("student_detail.remaining_minutes_label")}'],
  ['>抗遗忘次数<', '>{t("student_detail.review_times")}<'],
  ['>快捷操作<', '>{t("student_detail.quick_actions")}<'],
  ['>重置密码<', '>{t("student_detail.reset_password")}<'],
  ['>添加词库<', '>{t("student_detail.add_wordbook")}<'],
  ['tip="加载词库…"', 'tip={t("student_detail.loading_wordbooks")}'],
  ['description="尚未为该学员分配词库，点击「添加词库」从全局目录选择。"', 'description={t("student_detail.no_wordbooks")}'],
  ['aria-label="移除词库"', 'aria-label={t("student_detail.remove_wordbook")}'],
  ['tip="加载测评记录…"', 'tip={t("student_detail.loading_vocab")}'],
  ['description="暂无词汇测评记录"', 'description={t("student_detail.no_vocab")}'],
  ['<DialogTitle>添加词库</DialogTitle>', '<DialogTitle>{t("student_detail.add_wordbook_title")}</DialogTitle>'],
  ['<DialogDescription>从全局词库目录为学员分配</DialogDescription>', '<DialogDescription>{t("student_detail.add_wordbook_desc")}</DialogDescription>'],
  ['placeholder="搜索词库名称…"', 'placeholder={t("student_detail.search_wordbooks")}'],
  ['? "词库加载中或暂无可用词库" : "没有可添加的词库"', '? t("student_detail.catalog_loading") : t("student_detail.no_addable")'],
  ['>添加<', '>{t("student_detail.add")}<'],
  ['<DialogTitle>移除学员</DialogTitle>', '<DialogTitle>{t("student_detail.remove_student_title")}</DialogTitle>'],
  ['>确认移除<', '>{t("student_detail.confirm_remove")}<'],
  ['>保存密码<', '>{t("my_students.save_password")}<'],
  ['>导出单词<', '>{t("training_records.export_words")}<'],
  ['>正课记录<', '>{t("training_records.tab_study")}<'],
  ['>抗遗忘记录<', '>{t("training_records.tab_review")}<'],
  ['>学员<', '>{t("training_records.student")}<'],
  ['placeholder={studentsLoading ? "加载学员…" : "选择学员"}', 'placeholder={studentsLoading ? t("training_records.loading_students") : t("training_records.select_student")}'],
  ['sheetTitle="选择学员"', 'sheetTitle={t("training_records.select_student")}'],
  ['>日期范围<', '>{t("training_records.date_range")}<'],
  ['{ id: "all", label: "全部" }', '{ id: "all", label: t("training_records.date_all") }'],
  ['{ id: "day", label: "某天" }', '{ id: "day", label: t("training_records.date_day") }'],
  ['{ id: "range", label: "区间" }', '{ id: "range", label: t("training_records.date_range_label") }'],
  ['placeholder="开始日期"', 'placeholder={t("training_records.start_date")}'],
  ['placeholder="结束日期"', 'placeholder={t("training_records.end_date")}'],
  ['>至<', '>{t("training_records.to")}<'],
  ['placeholder="全部词库"', 'placeholder={t("training_records.all_wordbooks")}'],
  ['sheetTitle="筛选词库"', 'sheetTitle={t("training_records.filter_wordbook")}'],
  ['>暂无匹配记录<', '>{t("training_records.no_records")}<'],
  ['>试试调整日期或词库筛选<', '>{t("training_records.adjust_filters")}<'],
  ['>导出<', '>{t("training_records.export")}<'],
  ['>开始导出<', '>{t("training_records.start_export")}<'],
  ['showToast.error("请先选择学员再导出")', 'showToast.error(t("training_records.select_student_export"))'],
  ['showToast.error("暂无单词可导出")', 'showToast.error(t("training_records.no_words_export"))'],
  ['showToast.error("加载详情失败")', 'showToast.error(t("training_records.load_detail_failed"))'],
  ['<PageBackHeader title="添加课程"', '<PageBackHeader title={t("create_appointment.title")}'],
  ['showToast.warning("请选择学生")', 'showToast.warning(t("create_appointment.select_student_warn"))'],
  ['showToast.error("加载学员列表失败")', 'showToast.error(t("create_appointment.load_students_failed"))'],
  ['<PageBackHeader title="上传词书"', '<PageBackHeader title={t("create_wordbook.title")}'],
  ['showToast.info("请填写词书名称")', 'showToast.info(t("create_wordbook.enter_name"))'],
  ['showToast.success("词书已创建")', 'showToast.success(t("create_wordbook.created"))'],
  ['description="暂无已上课程"', 'description={t("coach_sessions.empty")}'],
  ['<DialogTitle className="text-foreground">课程详情</DialogTitle>', '<DialogTitle className="text-foreground">{t("coach_sessions.detail_title")}</DialogTitle>'],
];

for (const file of files) {
  const fp = path.join(pagesDir, file);
  if (!fs.existsSync(fp)) continue;
  let c = fs.readFileSync(fp, "utf8");
  const orig = c;
  for (const [from, to] of replacements) {
    if (c.includes(from)) c = c.split(from).join(to);
  }
  if (c !== orig) {
    fs.writeFileSync(fp, c);
    console.log("pass2", file);
  }
}
