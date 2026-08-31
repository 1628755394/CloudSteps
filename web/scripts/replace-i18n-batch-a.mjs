#!/usr/bin/env node
import fs from "fs";
import path from "path";

const pagesDir = path.join(process.cwd(), "src/pages");

/** Global replacements applied to all patched files (longest first) */
const globalReplacements = [
  ['title="单词训练"', 'title={t("word_training.title")}'],
  ['title="训前检测"', 'title={t("pre_training_check.title")}'],
  ['title="听音识词"', 'title={t("listen_identify.title")}'],
  ['title="训练检测"', 'title={t("review_check.title")}'],
  ['title={mode === "review" ? "开始复习" : "单词练习"}', 'title={mode === "review" ? t("practice.start_review") : t("practice.title")}'],
  ['title={viewOnly ? "查看" : "开始复习"}', 'title={viewOnly ? t("practice.view") : t("practice.start_review")}'],
  ['title={mode === "review" ? "开始复习" : phaseLabels.title}', 'title={mode === "review" ? t("practice.start_review") : phaseLabels.title}'],
  ['pauseContinueLabel="继续练习"', 'pauseContinueLabel={t("practice.continue_practice")}'],
  ['label="笔记"', 'label={t("practice.note")}'],
  ['title={`笔记 · ${', 'title={t("practice.note_title", { word: '],
  ['}`}\n              label={t("practice.note")}', '})}\n              label={t("practice.note")}'],
  ['title="随心记"', 'title={t("practice.free_note")}'],
  ['aria-label="打开随心记"', 'aria-label={t("practice.open_free_note")}'],
  ['title="打开随心记"', 'title={t("practice.open_free_note")}'],
  ['title="拖动调整随心记宽度"', 'title={t("practice.resize_free_note")}'],
  ['>乱序<', '>{t("practice.shuffle")}<'],
  ['>拓展<', '>{t("practice.expand")}<'],
  ['>随心记<', '>{t("practice.free_note")}<'],
  ['>全选<', '>{t("practice.select_all")}<'],
  ['>正序<', '>{t("practice.sequential")}<'],
  ['>重新乱序<', '>{t("practice.reshuffle")}<'],
  ['>简易<', '>{t("practice.simple")}<'],
  ['>人工带读<', '>{t("practice.manual_read")}<'],
  ['>选择5个<', '>{t("practice.select_five")}<'],
  ['>开始识记<', '>{t("practice.start_learning")}<'],
  ['loadingText="启动中…"', 'loadingText={t("practice.starting")}'],
  ['loadingText="提交中…"', 'loadingText={t("practice.submitting")}'],
  ['loadingText="准备中…"', 'loadingText={t("practice.preparing")}'],
  ['{fullMeaning ? "简译" : "全部意思"}', '{fullMeaning ? t("practice.short_meaning") : t("practice.full_meaning")}'],
  ['>返回<', '>{t("practice.back")}<'],
  ['>取消<', '>{t("practice.cancel")}<'],
  ['>保存<', '>{t("practice.save")}<'],
  ['>关闭<', '>{t("practice.close")}<'],
  ['>复制<', '>{t("practice.copy")}<'],
  ['>完成<', '>{t("practice.done")}<'],
  ['>刷新<', '>{t("practice.refresh")}<'],
  ['>上一页<', '>{t("practice.prev_page")}<'],
  ['>下一页<', '>{t("practice.next_page")}<'],
  ['aria-label="上一个"', 'aria-label={t("practice.prev")}'],
  ['aria-label="下一个"', 'aria-label={t("practice.next")}'],
  ['aria-label="播放发音"', 'aria-label={t("practice.play_audio")}'],
  ['>点击播放<', '>{t("practice.tap_play")}<'],
  ['>再点显示答案<', '>{t("practice.tap_reveal")}<'],
  ['tip="加载中…"', 'tip={t("practice.loading")}'],
  ['tip="加载学员…"', 'tip={t("word_training.loading_students")}'],
  ['placeholder="选择词库"', 'placeholder={t("word_training.select_wordbook")}'],
  ['sheetTitle="选择词库"', 'sheetTitle={t("word_training.select_wordbook")}'],
  ['>开始复习<', '>{t("word_training.start_review")}<'],
  ['>继续练习<', '>{t("word_training.continue_practice")}<'],
  ['>返回首页<', '>{t("word_training.back_home")}<'],
  ['>新建学员<', '>{t("word_training.create_student")}<'],
  ['>去学员管理<', '>{t("word_training.manage_students")}<'],
  ['>开始学习<', '>{t("practice.start_study")}<'],
  ['>提交复习<', '>{t("practice.submit_review")}<'],
  ['>全部认识<', '>{t("practice.mark_all_known")}<'],
  ['>清空<', '>{t("practice.clear")}<'],
  ['>返回练习<', '>{t("flash_review.back_practice")}<'],
  ['showToast.error("加载失败")', 'showToast.error(formatApiMessage(undefined, "common.query_failed"))'],
  ['showToast.error("保存失败")', 'showToast.error(formatApiMessage(undefined, "common.operation_failed"))'],
  ['showToast.error("创建失败")', 'showToast.error(formatApiMessage(undefined, "common.operation_failed"))'],
  ['showToast.error("设置失败")', 'showToast.error(formatApiMessage(undefined, "common.operation_failed"))'],
  ['showToast.error("导出失败")', 'showToast.error(formatApiMessage(undefined, "common.export_failed"))'],
  ['showToast.error(res.msg || "加载失败")', 'showToast.error(formatApiMessage(res.msg, "common.query_failed"))'],
  ['showToast.error(res.msg || "保存失败")', 'showToast.error(formatApiMessage(res.msg, "common.operation_failed"))'],
  ['showToast.error(res.msg || "创建失败")', 'showToast.error(formatApiMessage(res.msg, "common.operation_failed"))'],
  ['showToast.error(res.msg || "设置失败")', 'showToast.error(formatApiMessage(res.msg, "common.operation_failed"))'],
  ['showToast.error(res.msg || "添加失败")', 'showToast.error(formatApiMessage(res.msg, "common.operation_failed"))'],
  ['showToast.error(res.msg || "移除失败")', 'showToast.error(formatApiMessage(res.msg, "common.operation_failed"))'],
  ['showToast.error(res.msg || "删除失败")', 'showToast.error(formatApiMessage(res.msg, "common.operation_failed"))'],
  ['showToast.error(res.msg || "导出失败")', 'showToast.error(formatApiMessage(res.msg, "common.export_failed"))'],
  ['showToast.error(res.msg || "加载词库失败")', 'showToast.error(formatApiMessage(res.msg, "study.wordbook_query_failed"))'],
  ['showToast.error(res.msg || "加载测评失败")', 'showToast.error(formatApiMessage(res.msg, "common.query_failed"))'],
  ['throw new Error(res.msg || "提交失败")', 'throw new Error(formatApiMessage(res.msg, "practice.submit_failed"))'],
  ['setError("加载单词失败，请重试")', 'setError(t("practice.load_words_failed"))'],
  ['alert("错词数据异常，无法进入重练")', 'alert(t("practice.wrong_data_error"))'],
];

const fileSpecific = {
  "WordTraining.tsx": [
    ['"授课额度已用尽"', 't("word_training.pool_empty_title")'],
    ['"还没有学员"', 't("word_training.no_students_title")'],
    ['label: `学员词库 · ${b.name}`', 'label: t("word_training.student_wordbook", { name: b.name })'],
    ['placeholder={wordBooks.length || studentWordBooks.length ? "选择词库" : "加载词库中…"}', 'placeholder={wordBooks.length || studentWordBooks.length ? t("word_training.select_wordbook") : t("word_training.loading_wordbooks")}'],
    ['<span className="text-[#718096]">训练日期</span>', '<span className="text-[#718096]">{t("word_training.training_date")}</span>'],
    ['<span className="text-[#718096]">今日训新</span>', '<span className="text-[#718096]">{t("word_training.today_new")}</span>'],
    ['{todayNewLearned} 词', '{todayNewLearned} {t("practice.words_unit")}'],
    ['<div className="text-[11px] text-[#718096]">今日训新</div>', '<div className="text-[11px] text-[#718096]">{t("word_training.today_new")}</div>'],
    ['<div className="text-[11px] text-[#718096]">今日复习目标</div>', '<div className="text-[11px] text-[#718096]">{t("word_training.today_review_target")}</div>'],
    ['<div className="text-[11px] text-[#718096]">累计识词</div>', '<div className="text-[11px] text-[#718096]">{t("word_training.total_mastered")}</div>'],
    ['<h3 className="text-sm font-semibold text-[#2D3748]">智能记忆灯塔</h3>', '<h3 className="text-sm font-semibold text-[#2D3748]">{t("word_training.memory_lighthouse")}</h3>'],
  ],
  "WordPractice.tsx": [
    ['{mode === "review" ? "暂无复习单词，请返回重新勾选" : "暂无待练习单词，请返回重新选择"}', '{mode === "review" ? t("practice.no_review_words_back") : t("practice.no_words_to_practice")}'],
    ['>返回选择单词<', '>{t("practice.back_select_words")}<'],
    ['{batchIdx + 1}/{totalBatches}组', '{t("practice.batch_group", { current: batchIdx + 1, total: totalBatches })}'],
  ],
  "PreTrainingCheck.tsx": [
    ['setError("当前没有待练习单词，请返回词库重新选择需要识记的单词")', 'setError(t("practice.no_words_session"))'],
    ['>上拉加载更多<', '>{t("practice.load_more")}<'],
    ['<span className="text-[#718096] text-sm">已加载全部单词</span>', '<span className="text-[#718096] text-sm">{t("practice.all_words_loaded")}</span>'],
    ['title={simpleDetail ? "当前简易：点击查看全部拓展" : "当前全部：点击切回简易"}', 'title={simpleDetail ? t("practice.simple_tip_on") : t("practice.simple_tip_off")}'],
  ],
  "PostTrainingCheck.tsx": [
    ['return "完成复习"', 'return t("practice.complete_review")'],
    ['return `重练 ${wrongWords.length} 个错词`', 'return t("practice.retry_wrong", { count: wrongWords.length })'],
    ['return "提交并进入训后检测"', 'return t("practice.submit_post_check")'],
    ['return "提交并继续下一组"', 'return t("practice.submit_next_batch")'],
    ['return "提交并完成训练"', 'return t("practice.submit_finish")'],
    ['return "提交并继续"', 'return t("practice.submit_continue")'],
    ['<span className="hidden sm:inline">5个正确</span>', '<span className="hidden sm:inline">{t("practice.mark_five_correct")}</span>'],
    ['<span className="hidden sm:inline">5个错误</span>', '<span className="hidden sm:inline">{t("practice.mark_five_wrong")}</span>'],
  ],
  "FlashReview.tsx": [
    ['? "错词快闪重练"', '? t("flash_review.retry_title")'],
    ['`第 ${batchIdx + 1} 组快闪`', 't("flash_review.batch_title", { n: batchIdx + 1 })'],
    ['? "完成重练"', '? t("flash_review.finish_retry")'],
    ['? "继续下一组"', '? t("flash_review.next_batch")'],
    [': "进入组内复习"', ': t("flash_review.enter_group_review")'],
    ['title="红剪：不熟，重新排队"', 'title={t("flash_review.red_scissor_tip")}'],
    ['title="青剪：掌握"', 'title={t("flash_review.green_scissor_tip")}'],
    ['{isRetryMode ? "错词重练完成！" : "恭喜完成本组快闪！"}', '{isRetryMode ? t("flash_review.retry_done") : t("flash_review.batch_done")}'],
  ],
  "ReviewCheck.tsx": [
    ['setEmptyMessage(res.msg || "今日无待复习单词")', 'setEmptyMessage(formatApiMessage(res.msg, "practice.no_review_words"))'],
    ['setEmptyMessage(res.msg || "暂无可复习内容")', 'setEmptyMessage(formatApiMessage(res.msg, "practice.no_review_content"))'],
    [': "加载失败"', ': formatApiMessage(undefined, "common.query_failed")'],
    ['setHint("请至少为一个单词选择 ✓ 或 × 后再开始学习")', 'setHint(t("practice.mark_before_study"))'],
    ['setHint("复习会话未就绪，请返回重进")', 'setHint(t("practice.session_not_ready"))'],
    ['setHint("无法开始学习，请稍后重试")', 'setHint(t("practice.cannot_start"))'],
    ['<p className="text-center text-[#718096] py-12">加载中…</p>', '<p className="text-center text-[#718096] py-12">{t("practice.loading")}</p>'],
    ['<p className="text-sm text-[#718096]">当前词库没有到期的复习任务，可先进行单词训练或改日再来。</p>', '<p className="text-sm text-[#718096]">{t("practice.empty_review_hint")}</p>'],
    ['`当前共有 ${words.length} 个可选单词`', 't("practice.optional_words", { count: words.length })'],
    ['先勾选要复习的词，再进入跟课前检测一样的练习流程', '{t("practice.hint_select_review")}'],
  ],
  "ReviewWordList.tsx": [
    ['setHint("当前没有可复习的单词")', 'setHint(t("practice.no_reviewable"))'],
    ['setHint("无待复习单词，已返回")', 'setHint(t("practice.no_review_return"))'],
    ['setHint("提交复习结果失败，请稍后重试")', 'setHint(t("practice.submit_review_failed"))'],
    ['? `当前共有 ${words.length} 个单词` : `当前共有 ${words.length} 个可选单词`', '? t("lighthouse_words.total_words", { count: words.length }) : t("practice.optional_words", { count: words.length })'],
    ['该日暂无待复习单词', '{t("practice.no_words_today")}'],
    ['已全部勾选，可提交复习', '{t("practice.all_marked_submit")}'],
  ],
  "CoachCenter.tsx": [
    ['label: "反馈给我们"', 'label: t("coach_center.feedback")'],
    ['description: "问题与建议"', 'description: t("coach_center.feedback_desc")'],
    ['label: "设置"', 'label: t("coach_center.settings")'],
    ['label: "已上课程"', 'label: t("coach_center.completed_sessions")'],
    ['description: "近 90 天陪练记录"', 'description: t("coach_center.completed_desc")'],
    ['<p className="text-[11px] text-muted-foreground mt-0.5">陪练中心</p>', '<p className="text-[11px] text-muted-foreground mt-0.5">{t("coach_center.subtitle")}</p>'],
    ['aria-label="编辑资料"', 'aria-label={t("coach_center.edit_profile")}'],
    ['<span className="text-[11px] font-medium text-primary">授课额度</span>', '<span className="text-[11px] font-medium text-primary">{t("coach_center.teaching_quota")}</span>'],
    ['功能中心', '{t("coach_center.feature_center")}'],
    ['title="男"', 'title={t("coach_center.male")}'],
    ['aria-label="男"', 'aria-label={t("coach_center.male")}'],
    ['title="女"', 'title={t("coach_center.female")}'],
    ['aria-label="女"', 'aria-label={t("coach_center.female")}'],
  ],
  "MyStudents.tsx": [
    ['aria-label="返回首页"', 'aria-label={t("my_students.back_home")}'],
    ['<span className="text-sm font-semibold text-foreground">学员管理</span>', '<span className="text-sm font-semibold text-foreground">{t("my_students.title")}</span>'],
    ['>新建<', '>{t("my_students.create")}<'],
    ['>关联<', '>{t("my_students.link")}<'],
    ['aria-label="刷新"', 'aria-label={t("my_students.refresh")}'],
    ['<DialogTitle>设置登录密码</DialogTitle>', '<DialogTitle>{t("my_students.set_password")}</DialogTitle>'],
    ['placeholder="搜索姓名 / 账号 / 手机…"', 'placeholder={t("my_students.search_placeholder")}'],
    ['? "没有匹配的学员"', '? t("my_students.no_match")'],
    [': "暂无学员。点击右上角「新建」创建账号，或「关联」已有学员。"', ': t("my_students.empty")'],
    ['<span className="hidden sm:inline">密码</span>', '<span className="hidden sm:inline">{t("my_students.password")}</span>'],
    ['showToast.warning("密码至少 6 位")', 'showToast.warning(t("my_students.password_min"))'],
    ['<p className="text-center text-[11px] text-muted-soft py-1">没有更多了</p>', '<p className="text-center text-[11px] text-muted-soft py-1">{t("practice.no_more")}</p>'],
  ],
  "CreateStudent.tsx": [
    ['<PageBackHeader title="新建学生"', '<PageBackHeader title={t("create_student.title")}'],
    ['showToast.success("已复制")', 'showToast.success(t("create_student.copied"))'],
    ['showToast.error("复制失败，请手动选择")', 'showToast.error(t("create_student.copy_failed"))'],
    ['showToast.warning("请输入学生姓名")', 'showToast.warning(t("create_student.enter_name"))'],
    ['showToast.warning("学时无效")', 'showToast.warning(t("create_student.invalid_hours"))'],
    ['showToast.success("学生已创建")', 'showToast.success(t("create_student.created"))'],
  ],
  "CheckIn.tsx": [
    ['showToast.error(res.msg || "加载失败")', 'showToast.error(formatApiMessage(res.msg, "common.query_failed"))'],
    ['showToast.error(res.msg || "签到失败")', 'showToast.error(formatApiMessage(res.msg, "check_in.failed"))'],
    ['showToast.info("今日已签到")', 'showToast.info(t("check_in.already_today"))'],
    ['aria-label="返回陪练中心"', 'aria-label={t("check_in.back_coach")}'],
    ['<h3 className="text-sm font-semibold text-foreground tracking-tight">每日签到</h3>', '<h3 className="text-sm font-semibold text-foreground tracking-tight">{t("check_in.title")}</h3>'],
  ],
  "CoachCompletedSessions.tsx": [
    ['aria-label="返回陪练中心"', 'aria-label={t("coach_sessions.back_coach")}'],
    ['已完成', 't("coach_sessions.status_completed")'],
    ['已排课', 't("coach_sessions.status_scheduled")'],
    ['进行中', 't("coach_sessions.status_in_progress")'],
    ['已取消', 't("coach_sessions.status_cancelled")'],
  ],
};

function applyReplacements(content, replacements) {
  let c = content;
  for (const [from, to] of replacements) {
    if (c.includes(from)) c = c.split(from).join(to);
  }
  return c;
}

for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith(".tsx"))) {
  if (!fileSpecific[file] && !["WordTraining.tsx","WordPractice.tsx","PreTrainingCheck.tsx","PostTrainingCheck.tsx","ListenIdentify.tsx","FlashReview.tsx","ReviewCheck.tsx","ReviewWordList.tsx","AntiForgetting.tsx","TrainingRecords.tsx","CoachCenter.tsx","MyStudents.tsx","StudentDetail.tsx","CreateStudent.tsx","CreateCoachingAppointment.tsx","CoachCompletedSessions.tsx","CheckIn.tsx","WordBookWords.tsx","CreateCustomWordBook.tsx"].includes(file)) continue;

  const fp = path.join(pagesDir, file);
  let c = fs.readFileSync(fp, "utf8");
  const orig = c;
  c = applyReplacements(c, globalReplacements);
  if (fileSpecific[file]) c = applyReplacements(c, fileSpecific[file]);
  if (c !== orig) {
    fs.writeFileSync(fp, c);
    console.log("replaced strings in", file);
  }
}

console.log("String replacements done");
