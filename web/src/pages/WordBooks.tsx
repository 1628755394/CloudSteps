import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Alert, Card, Empty, Grid, Spin, Statistic, Tag, Typography } from "@arco-design/web-react";
import { IconBook, IconRight } from "@arco-design/web-react/icon";
import { listWordBooks, type WordBookItem } from "../api/wordbooks";

const { Row, Col } = Grid;

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)",
];

function coverGradient(name: string) {
  const idx = name.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

const WordBookCover = ({ name }: { name: string }) => {
  const firstChar = name.charAt(0).toUpperCase();

  return (
    <div
      className="w-full h-24 flex items-center justify-center relative overflow-hidden"
      style={{ background: coverGradient(name) }}
    >
      <span className="text-3xl font-bold text-white/20 select-none absolute right-2 bottom-1 leading-none">
        {firstChar}
      </span>
      <span className="text-xl font-bold text-white drop-shadow-lg z-10">{firstChar}</span>
    </div>
  );
};

export default function WordBooks() {
  const [books, setBooks] = useState<WordBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await listWordBooks();
        if (cancelled) return;
        if (res.code !== 200) {
          setErr(res.msg || "加载失败");
          setBooks([]);
          return;
        }
        setBooks(Array.isArray(res.data) ? res.data : []);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
          setErr(msg);
          setBooks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalWords = useMemo(
    () => books.reduce((sum, book) => sum + (book.wordCount || 0), 0),
    [books]
  );
  const levelCount = useMemo(
    () => new Set(books.map((book) => book.level).filter(Boolean)).size,
    [books]
  );

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-20">
      <div className="bg-gradient-to-br from-[#4ECDC4] to-[#55A3FF] text-white">
        <div className="px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <IconBook style={{ fontSize: 32, color: "#fff" }} />
            </div>
            <div>
              <Typography.Title heading={4} className="!mb-0 !text-white">
                词库
              </Typography.Title>
              <Typography.Text className="!text-white/80 text-sm">
                选择词库查看单词、音标、释义并播放发音
              </Typography.Text>
            </div>
          </div>

          <Row gutter={16} className="mt-6">
            <Col span={8}>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <Statistic
                  title={<span className="text-white/80 text-xs">总词库</span>}
                  value={books.length}
                  styleValue={{ color: "#fff", fontWeight: 700 }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <Statistic
                  title={<span className="text-white/80 text-xs">总词汇</span>}
                  value={totalWords}
                  styleValue={{ color: "#fff", fontWeight: 700 }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <Statistic
                  title={<span className="text-white/80 text-xs">难度级别</span>}
                  value={levelCount}
                  styleValue={{ color: "#fff", fontWeight: 700 }}
                />
              </div>
            </Col>
          </Row>
        </div>
      </div>

      <div className="px-4 mt-6">
        {err && (
          <Alert type="error" content={err} className="!mb-4" showIcon />
        )}

        {loading ? (
          <div className="bg-white rounded-xl p-10 flex justify-center border border-[#E2E8F0]">
            <Spin tip="加载中…" />
          </div>
        ) : books.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-[#E2E8F0]">
            <Empty icon={<IconBook style={{ fontSize: 48 }} />} description="暂无词库" />
          </div>
        ) : (
          <Row gutter={[12, 12]}>
            {books.map((b) => (
              <Col key={b.id} xs={12} sm={8} md={6} lg={6} xl={4}>
                <Link to={`/word-books/${b.id}`} className="block group no-underline">
                  <Card
                    hoverable
                    className="!rounded-xl overflow-hidden border border-[#E2E8F0] group-hover:border-[#4ECDC4]/50"
                    cover={
                      <div className="relative">
                        <WordBookCover name={b.name} />
                        {b.level && (
                          <Tag
                            size="small"
                            className="!absolute !top-2 !left-2 !bg-white/20 !text-white !border-0 backdrop-blur"
                          >
                            {b.level}
                          </Tag>
                        )}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                            <IconRight style={{ color: "#fff", fontSize: 12 }} />
                          </div>
                        </div>
                      </div>
                    }
                    bodyStyle={{ padding: 12 }}
                  >
                    <Typography.Title
                      heading={6}
                      ellipsis={{ rows: 2 }}
                      className="!mb-2 !text-[#2D3748] group-hover:!text-[#4ECDC4]"
                    >
                      {b.name}
                    </Typography.Title>
                    <div className="flex items-center gap-2 text-xs text-[#718096]">
                      <span className="inline-flex items-center gap-0.5">
                        <IconBook style={{ fontSize: 12 }} />
                        {b.wordCount || 0}
                      </span>
                      <Tag size="small" color="arcoblue">
                        {b.level || "未分级"}
                      </Tag>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#A0AEC0]">
                      <span>点击学习</span>
                      <IconRight style={{ fontSize: 12, color: "#4ECDC4" }} />
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
