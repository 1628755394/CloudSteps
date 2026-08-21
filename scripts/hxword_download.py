#!/usr/bin/env python3
"""
hxword.cn 完整数据下载脚本（v2）
从 hxword.cn 获取所有可访问的公开数据，包括：
- 用户/教师信息、权限、会员套餐
- 词书导航分类树、语法体系树
- 阅读理解/完形填空/语篇分类路由
- 公开题库(Market Resource)所有资源列表+内容预览
- 免费词库的完整单词列表（通过 addToMine + custom/bookInfo）
- 阅读理解/完形填空的完整内容（通过 preview 接口）

输出目录: CloudSteps/hxword_export/
"""

import subprocess
import json
import base64
import os
import sys
import time
from datetime import datetime
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad

# ── 配置 ──────────────────────────────────────────────
BASE_URL = "https://hxword.cn"
ACCOUNT = "faker"
PASSWORD = "admin123"
AES_KEY = b"teacher-lite-key-32-bytes-abcdef"
AES_IV = b"teacher-lite-iv1"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(REPO_ROOT, "hxword_export")

# ── 加解密 ────────────────────────────────────────────
def decrypt_response(data_str: str):
    clean = data_str.strip()
    pad_needed = (4 - len(clean) % 4) % 4
    clean_padded = clean + "=" * pad_needed
    encrypted_bytes = base64.b64decode(clean_padded)
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    decrypted = unpad(cipher.decrypt(encrypted_bytes), AES.block_size)
    return json.loads(decrypted.decode("utf-8"))

# ── HTTP ──────────────────────────────────────────────
def curl_get(token: str, path: str) -> dict:
    result = subprocess.run(
        ["curl", "-s", f"{BASE_URL}{path}", "-H", f"Authorization: Bearer {token}"],
        capture_output=True, text=True, timeout=30,
    )
    try:
        resp = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": "invalid response", "raw": result.stdout[:500]}
    if resp.get("code") == 1000 and resp.get("encrypted") is True and isinstance(resp.get("data"), str):
        try:
            resp["data"] = decrypt_response(resp["data"])
        except Exception as e:
            resp["_decrypt_error"] = str(e)
    return resp

def curl_post(token: str, path: str, body: dict) -> dict:
    # 请求加密已禁用 (VITE_TEACHER_LITE_REQ_ENCRYPT="false")，发送明文 JSON
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", f"{BASE_URL}{path}",
         "-H", f"Authorization: Bearer {token}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(body, ensure_ascii=False)],
        capture_output=True, text=True, timeout=30,
    )
    try:
        resp = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": "invalid response", "raw": result.stdout[:500]}
    if resp.get("code") == 1000 and resp.get("encrypted") is True and isinstance(resp.get("data"), str):
        try:
            resp["data"] = decrypt_response(resp["data"])
        except Exception as e:
            resp["_decrypt_error"] = str(e)
    return resp

# ── 文件保存 ──────────────────────────────────────────
def save_json(filename: str, data):
    filepath = os.path.join(OUTPUT_DIR, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {filename} ({os.path.getsize(filepath)} bytes)")

def save_text(filename: str, text: str):
    filepath = os.path.join(OUTPUT_DIR, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  ✓ {filename} ({os.path.getsize(filepath)} bytes)")

# ── 登录 ──────────────────────────────────────────────
def login() -> str:
    print("→ 登录 hxword.cn...")
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", f"{BASE_URL}/api/app/teacher/account/login",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"account": ACCOUNT, "password": PASSWORD})],
        capture_output=True, text=True, timeout=30,
    )
    resp = json.loads(result.stdout)
    if resp.get("code") != 1000:
        print(f"  ✗ 登录失败: {resp}")
        sys.exit(1)
    token = resp["data"]["token"]
    teacher = resp["data"]["teacher"]
    print(f"  ✓ 登录成功: {teacher['username']} (id={teacher['id']}, VIP到期: {teacher.get('vipExpireTime')})")
    save_json("account/login_response.json", resp)
    return token

# ── 主逻辑 ────────────────────────────────────────────
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"hxword.cn 数据下载 v2 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"{'='*60}\n")

    token = login()

    # ── 1. 用户信息 ──────────────────────────────────
    print("\n→ 1. 下载用户/教师信息...")
    for name, path in [
        ("person", "/api/app/teacher/account/person"),
        ("teacherPerson", "/api/app/teacher/account/teacherPerson"),
        ("permissionList", "/api/app/teacher/account/permissionList"),
        ("wordLearningModeConfig", "/api/app/teacher/account/wordLearningModeConfig"),
        ("wordStudyButtonConfig", "/api/app/teacher/account/wordStudyButtonConfig"),
    ]:
        resp = curl_get(token, path)
        save_json(f"account/{name}.json", resp)

    # ── 2. 会员套餐 ──────────────────────────────────
    print("\n→ 2. 下载会员套餐...")
    resp = curl_get(token, "/api/app/teacher/membershipPackage/list")
    save_json("membership/packages.json", resp)

    # ── 3. 词书导航 ──────────────────────────────────
    print("\n→ 3. 下载词书导航分类...")
    resp = curl_get(token, "/api/app/teacher/books/navigation")
    save_json("books/navigation.json", resp)
    resp = curl_get(token, "/api/app/teacher/books/myBookList")
    save_json("books/myBookList.json", resp)

    # ── 4. 语法体系 ──────────────────────────────────
    print("\n→ 4. 下载语法体系...")
    resp = curl_get(token, "/api/app/teacher/grammar/treeWithArticles")
    save_json("grammar/treeWithArticles.json", resp)

    # ── 5. 分类路由 ──────────────────────────────────
    print("\n→ 5. 下载内容分类路由...")
    for content_type, path in [
        ("reading", "/api/app/teacher/reading/routes"),
        ("cloze", "/api/app/teacher/cloze/routes"),
        ("context", "/api/app/teacher/context/routes"),
        ("followReading", "/api/app/teacher/followReading/routes"),
        ("courseware", "/api/app/teacher/courseware/routes"),
    ]:
        resp = curl_get(token, path)
        save_json(f"routes/{content_type}_routes.json", resp)

    # ── 6. 内容列表 ──────────────────────────────────
    print("\n→ 6. 下载内容列表...")
    for content_type, path in [
        ("reading", "/api/app/teacher/reading/page?page=1&pageSize=100"),
        ("cloze", "/api/app/teacher/cloze/page?page=1&pageSize=100"),
        ("context", "/api/app/teacher/context/page?page=1&pageSize=100"),
        ("courseware", "/api/app/teacher/courseware/page?page=1&pageSize=100"),
        ("composition", "/api/app/teacher/composition/user/passage/page?page=1&pageSize=100"),
        ("listening", "/api/app/teacher/listening/list?page=1&pageSize=100"),
    ]:
        resp = curl_get(token, path)
        save_json(f"content_lists/{content_type}_page.json", resp)

    # ── 7. 公开题库列表 ──────────────────────────────
    print("\n→ 7. 下载公开题库(Market Resource)...")
    all_items = []
    page = 1
    while True:
        resp = curl_get(token, f"/api/app/teacher/marketResource/page?page={page}&pageSize=50")
        data = resp.get("data", {})
        items = data.get("list", [])
        total = data.get("pagination", {}).get("total", 0)
        all_items.extend(items)
        print(f"  页 {page}: {len(items)} 条 (总计 {total})")
        if len(all_items) >= total or not items:
            break
        page += 1
        time.sleep(0.3)

    save_json("market_resource/all_items.json", all_items)

    resp = curl_get(token, "/api/app/teacher/marketResource/routeList")
    save_json("market_resource/routeList.json", resp)

    # ── 8. 公开题库内容预览 ──────────────────────────
    print(f"\n→ 8. 下载每条公开题库的内容预览 ({len(all_items)} 条)...")
    for i, item in enumerate(all_items):
        item_id = item["id"]
        title = item.get("title", f"item_{item_id}")
        rtype = item.get("type", "unknown")
        safe_title = "".join(c if c.isalnum() or c in "._-" else "_" for c in title)[:60]

        print(f"  [{i+1}/{len(all_items)}] [{rtype}] {title}")

        resp = curl_get(token, f"/api/app/teacher/marketResource/preview?id={item_id}")
        filename = f"market_resource/previews/{rtype}_{item_id}_{safe_title}.json"
        save_json(filename, resp)
        time.sleep(0.3)

    # ── 9. 添加免费词库到我的库并获取完整单词列表 ────
    print("\n→ 9. 添加免费词库并下载完整单词列表...")
    free_word_ids = [item["id"] for item in all_items
                     if item.get("type") == "word" and item.get("isFree") == 1]
    print(f"  免费词库: {free_word_ids}")

    for rid in free_word_ids:
        resp = curl_post(token, "/api/app/teacher/marketResource/addToMine", {"resourceId": rid})
        print(f"  addToMine({rid}): {resp.get('message', '')}")
        time.sleep(0.3)

    # 获取自定义词书列表（添加后的）
    resp = curl_get(token, "/api/app/teacher/custom/bookList")
    custom_books = resp.get("data", [])
    save_json("custom_books/bookList.json", resp)

    # 下载每本词书的完整单词列表
    for book in custom_books:
        book_id = book["id"]
        name = book.get("name", f"book_{book_id}")
        word_count = book.get("w_count", 0)
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)[:60]
        print(f"  下载词书: {name} (id={book_id}, {word_count}词)")

        resp = curl_get(token, f"/api/app/teacher/custom/bookInfo?id={book_id}")
        data = resp.get("data", {})
        words = data.get("words", [])
        print(f"    获取到 {len(words)} 词")
        save_json(f"custom_books/full/{safe_name}_{book_id}.json", resp)
        time.sleep(0.3)

    # ── 10. 生成可读汇总 ─────────────────────────────
    print("\n→ 10. 生成可读汇总...")
    generate_readable_summary(all_items, custom_books)

    # ── 11. 下载报告 ─────────────────────────────────
    print("\n→ 11. 生成下载报告...")
    by_type = {}
    for item in all_items:
        rtype = item.get("type", "unknown")
        by_type.setdefault(rtype, []).append(item)

    total_words = 0
    for book in custom_books:
        book_id = book["id"]
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in book.get("name", ""))[:60]
        book_path = os.path.join(OUTPUT_DIR, f"custom_books/full/{safe_name}_{book_id}.json")
        if os.path.exists(book_path):
            with open(book_path, "r", encoding="utf-8") as f:
                bd = json.load(f)
                total_words += len(bd.get("data", {}).get("words", []))

    report = {
        "download_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": "hxword.cn",
        "account": ACCOUNT,
        "output_dir": OUTPUT_DIR,
        "data_summary": {
            "account_info": "account/",
            "membership_packages": "membership/packages.json",
            "books_navigation": "books/navigation.json",
            "grammar_tree": "grammar/treeWithArticles.json",
            "content_routes": "routes/",
            "content_lists": "content_lists/",
            "market_resource_total": len(all_items),
            "market_resource_items": "market_resource/all_items.json",
            "market_resource_previews": f"market_resource/previews/ ({len(all_items)} files)",
            "custom_books": f"custom_books/ ({len(custom_books)} books, {total_words} words total)",
            "readable_summary": "market_resource/readable_summary.md",
        },
        "market_resource_by_type": {k: len(v) for k, v in by_type.items()},
        "free_resources": sum(1 for i in all_items if i.get("isFree") == 1),
        "paid_resources": sum(1 for i in all_items if i.get("isFree") != 1),
        "custom_books_downloaded": len(custom_books),
        "total_words_downloaded": total_words,
    }
    save_json("download_report.json", report)

    print(f"\n{'='*60}")
    print(f"下载完成！")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"公开题库: {len(all_items)} 条 (免费 {report['free_resources']}, 付费 {report['paid_resources']})")
    print(f"完整词库: {len(custom_books)} 本, {total_words} 词")
    print(f"{'='*60}")


def generate_readable_summary(all_items, custom_books):
    """生成 Markdown 可读汇总"""
    parts = []
    parts.append(f"# hxword.cn 数据汇总\n\n")
    parts.append(f"下载时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    parts.append(f"总公开题库资源: {len(all_items)}\n")
    parts.append(f"完整词库: {len(custom_books)} 本\n\n")
    parts.append("---\n\n")

    # ── 阅读理解 ──
    parts.append("## 阅读理解\n\n")
    for item in all_items:
        if item.get("type") != "reading":
            continue
        title = item["title"]
        is_free = "免费" if item.get("isFree") == 1 else f"{item.get('priceXBean', 0)}X豆"
        parts.append(f"### {title}\n\n")
        parts.append(f"价格: {is_free} | 销量: {item.get('salesCount', 0)}\n\n")

        safe_title = "".join(c if c.isalnum() or c in "._-" else "_" for c in title)[:60]
        preview_path = os.path.join(OUTPUT_DIR, f"market_resource/previews/reading_{item['id']}_{safe_title}.json")
        if os.path.exists(preview_path):
            with open(preview_path, "r", encoding="utf-8") as f:
                pdata = json.load(f)
            preview = pdata.get("data", {}).get("preview", {})
            ri = preview.get("readingInfo", {})
            parts.append(f"难度: {ri.get('difficulty', '?')} | 类型: {ri.get('readingType', '?')}\n\n")
            parts.append("#### 文章\n\n")
            for para in preview.get("paragraphs", []):
                for sent in para.get("sentences", []):
                    parts.append(f"{sent['text']}\n")
                    if sent.get("translation"):
                        parts.append(f"> {sent['translation']}\n\n")
            questions = preview.get("questions", [])
            if questions:
                parts.append(f"#### 题目 ({len(questions)} 题)\n\n")
                for q in questions:
                    parts.append(f"**Q{q.get('sortNum', '?')}.** {q.get('stem', '')}\n\n")
                    if q.get("stemTranslation"):
                        parts.append(f"> {q['stemTranslation']}\n\n")
                    for opt in q.get("options", []):
                        parts.append(f"- **{opt['key']}.** {opt['text']}")
                        if opt.get("translation"):
                            parts.append(f" _{opt['translation']}_")
                        parts.append("\n")
                    parts.append("\n")
        parts.append("\n---\n\n")

    # ── 完形填空 ──
    parts.append("## 完形填空\n\n")
    for item in all_items:
        if item.get("type") != "cloze":
            continue
        title = item["title"]
        is_free = "免费" if item.get("isFree") == 1 else f"{item.get('priceXBean', 0)}X豆"
        parts.append(f"### {title}\n\n")
        parts.append(f"价格: {is_free} | 销量: {item.get('salesCount', 0)}\n\n")

        safe_title = "".join(c if c.isalnum() or c in "._-" else "_" for c in title)[:60]
        preview_path = os.path.join(OUTPUT_DIR, f"market_resource/previews/cloze_{item['id']}_{safe_title}.json")
        if os.path.exists(preview_path):
            with open(preview_path, "r", encoding="utf-8") as f:
                pdata = json.load(f)
            preview = pdata.get("data", {}).get("preview", {})
            ri = preview.get("readingInfo", {})
            parts.append(f"难度: {ri.get('difficulty', '?')} | 类型: {ri.get('readingType', '?')}\n\n")
            parts.append("#### 文章\n\n")
            for para in preview.get("paragraphs", []):
                for sent in para.get("sentences", []):
                    parts.append(f"{sent['text']}\n")
                    if sent.get("translation"):
                        parts.append(f"> {sent['translation']}\n\n")
                    for q in sent.get("questions", []):
                        parts.append(f"\n**填空:**\n\n")
                        for opt in q.get("options", []):
                            parts.append(f"- **{opt['key']}.** {opt['text']}\n")
                        parts.append("\n")
        parts.append("\n---\n\n")

    # ── 词库 ──
    parts.append("## 完整词库\n\n")
    for book in custom_books:
        book_id = book["id"]
        name = book.get("name", "")
        word_count = book.get("w_count", 0)
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)[:60]
        parts.append(f"### {name} ({word_count} 词)\n\n")

        book_path = os.path.join(OUTPUT_DIR, f"custom_books/full/{safe_name}_{book_id}.json")
        if os.path.exists(book_path):
            with open(book_path, "r", encoding="utf-8") as f:
                bd = json.load(f)
            words = bd.get("data", {}).get("words", [])
            parts.append(f"| # | 单词 | 美音 | 英音 | 释义 |\n|---|------|------|------|------|\n")
            for i, w in enumerate(words, 1):
                name_w = w.get("name", "")
                us = w.get("us", "")
                uk = w.get("uk", "")
                trans = w.get("translation", "")
                if isinstance(trans, list):
                    trans = "; ".join(trans)
                parts.append(f"| {i} | {name_w} | {us} | {uk} | {trans} |\n")
            parts.append("\n")
        parts.append("\n---\n\n")

    # ── 其他资源 ──
    parts.append("## 其他资源\n\n")
    for item in all_items:
        if item.get("type") in ("reading", "cloze", "word"):
            continue
        rtype = item["type"]
        title = item["title"]
        is_free = "免费" if item.get("isFree") == 1 else f"{item.get('priceXBean', 0)}X豆"
        parts.append(f"- [{rtype}] {title} ({is_free}, 销量: {item.get('salesCount', 0)})\n")

    save_text("market_resource/readable_summary.md", "".join(parts))


if __name__ == "__main__":
    main()
