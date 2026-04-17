import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import {
  Search,
  Upload,
  RefreshCw,
  Save,
  Trash2,
  Package2,
  MapPinned,
  AlertCircle,
  Download,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const RACKS = ["A", "B", "V", "G"];
const COLUMNS = [1, 2, 3, 4, 5, 6];
const ROWS = [1, 2, 3, 4];

function buildCells() {
  const cells = [];
  RACKS.forEach((rack) => {
    COLUMNS.forEach((column) => {
      ROWS.forEach((row) => {
        cells.push({
          cell_id: `${rack}${column}-${row}`,
          rack,
          column,
          row,
          title: `Стеллаж ${rack} / Колонка ${column} / Ряд ${row}`,
        });
      });
    });
  });
  return cells;
}

const allCells = buildCells();

function normalizeCode(value) {
  return String(value ?? "").trim();
}

function parseQty(row) {
  const candidates = [row["Остаток"], row["Доступно"], row["Количество"], row.qty, row.Qty, row.QTY];
  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").replace(/\s/g, "").replace(",", ".");
    if (normalized === "") continue;
    const num = Number(normalized);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function normalizeStockRow(row) {
  const code = normalizeCode(
    row["Код"] ?? row.code ?? row.Code ?? row.CODE
  ).replace(/\.0$/, "");

  const name = String(
    row["Наименование"] ?? row.name ?? row.Name ?? ""
  ).trim();

  return {
    code,
    name,
    qty: parseQty(row),
  };
}

function parseWorkbook(file, callback) {
  const reader = new FileReader();

  reader.onload = (event) => {
    const data = event.target?.result;
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    const matrix = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const headerRowIndex = matrix.findIndex((row) => {
      const values = row.map((cell) => String(cell).trim());
      return values.includes("Код") && values.includes("Наименование");
    });

    if (headerRowIndex === -1) {
      callback([]);
      return;
    }

    const headers = matrix[headerRowIndex].map((cell) => String(cell).trim());

    const rows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((cell) => String(cell).trim() !== ""))
      .map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = String(row[index] ?? "").trim();
        });
        return obj;
      });

    callback(rows);
  };

  reader.readAsArrayBuffer(file);
}

function getCellStatus(items) {
  if (!items.length) return "empty";
  const found = items.filter((item) => item.found).length;
  const positive = items.filter((item) => item.found && item.qty > 0).length;
  if (found === 0) return "error";
  if (positive === items.length) return "ok";
  if (positive === 0) return "zero";
  return "partial";
}

function statusClasses(status) {
  switch (status) {
    case "ok":
      return "border-green-300 bg-green-50 text-green-900";
    case "partial":
      return "border-yellow-300 bg-yellow-50 text-yellow-900";
    case "zero":
      return "border-red-300 bg-red-50 text-red-900";
    case "error":
      return "border-slate-300 bg-slate-100 text-slate-900";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function Card({ className = "", children }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function CardHeader({ children, className = "" }) {
  return <div className={`p-5 pb-3 ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={`p-5 pt-0 ${className}`}>{children}</div>;
}

function CardTitle({ children, className = "" }) {
  return <h2 className={`text-xl font-semibold text-slate-900 ${className}`}>{children}</h2>;
}

function CardDescription({ children, className = "" }) {
  return <p className={`mt-1 text-sm text-slate-500 ${className}`}>{children}</p>;
}

function Button({ children, className = "", variant = "solid", type = "button", ...props }) {
  const styles =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      : "bg-slate-900 text-white hover:bg-slate-800";
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 ${props.className || ""}`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 ${props.className || ""}`}
    />
  );
}

function Badge({ children, variant = "secondary", className = "" }) {
  const styles =
    variant === "destructive"
      ? "border border-red-300 bg-red-100 text-red-800"
      : variant === "outline"
        ? "border border-slate-300 bg-white text-slate-700"
        : "border border-slate-200 bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles} ${className}`}>{children}</span>;
}

function ScrollArea({ children, className = "" }) {
  return <div className={`overflow-auto ${className}`}>{children}</div>;
}

function Separator() {
  return <div className="h-px w-full bg-slate-200" />;
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

export default function App() {
  const [manualMap, setManualMap] = useState({});
  const [stocks, setStocks] = useState([]);
  const [selectedCell, setSelectedCell] = useState("A1-1");
  const [cellEditor, setCellEditor] = useState("");
  const [search, setSearch] = useState("");
  const [lastSync, setLastSync] = useState("Нет загрузок");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);

    const { data: cellCodes, error: cellCodesError } = await supabase
      .from("cell_codes")
      .select("cell_id, code")
      .order("cell_id");

    const { data: stockItems, error: stockItemsError } = await supabase
      .from("stock_items")
      .select("code, name, qty, updated_at")
      .order("code");

    if (cellCodesError) {
      alert(`Ошибка загрузки cell_codes: ${cellCodesError.message}`);
    }
    if (stockItemsError) {
      alert(`Ошибка загрузки stock_items: ${stockItemsError.message}`);
    }

    const grouped = {};
    (cellCodes || []).forEach((row) => {
      if (!grouped[row.cell_id]) grouped[row.cell_id] = [];
      grouped[row.cell_id].push(String(row.code));
    });

    setManualMap(grouped);
    setStocks((stockItems || []).map((item) => ({ code: String(item.code), name: item.name, qty: Number(item.qty || 0) })));
    setLastSync(`Данные из Supabase: ${new Date().toLocaleString()}`);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const codes = manualMap[selectedCell] || [];
    setCellEditor(codes.join("\n"));
  }, [selectedCell, manualMap]);

  const stockMap = useMemo(() => {
    const map = new Map();
    stocks.forEach((item) => {
      if (item.code) map.set(item.code, item);
    });
    return map;
  }, [stocks]);

  const cellItems = useMemo(() => {
    const codes = manualMap[selectedCell] || [];
    return codes.map((code) => {
      const stock = stockMap.get(code);
      return {
        code,
        found: !!stock,
        name: stock?.name || "Код не найден в выгрузке",
        qty: stock?.qty ?? 0,
      };
    });
  }, [manualMap, selectedCell, stockMap]);

  const totalQtyInCell = useMemo(() => cellItems.reduce((sum, item) => sum + item.qty, 0), [cellItems]);
  const totalMappedCodes = useMemo(() => Object.values(manualMap).reduce((sum, arr) => sum + arr.length, 0), [manualMap]);

  const unmatchedCodes = useMemo(() => {
    const rows = [];
    Object.entries(manualMap).forEach(([cellId, codes]) => {
      codes.forEach((code) => {
        if (!stockMap.has(code)) rows.push({ cellId, code });
      });
    });
    return rows;
  }, [manualMap, stockMap]);

  const mappedCodesSet = useMemo(() => {
    const set = new Set();
    Object.values(manualMap).forEach((codes) => {
      codes.forEach((code) => set.add(code));
    });
    return set;
  }, [manualMap]);

  const stocksWithoutCell = useMemo(() => {
    return stocks.filter((item) => item.code && !mappedCodesSet.has(item.code));
  }, [stocks, mappedCodesSet]);

  const totalStockQty = useMemo(() => stocks.reduce((sum, item) => sum + item.qty, 0), [stocks]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const rows = [];
    Object.entries(manualMap).forEach(([cellId, codes]) => {
      codes.forEach((code) => {
        const stock = stockMap.get(code);
        const haystack = [code, cellId, stock?.name || ""].join(" ").toLowerCase();
        if (haystack.includes(q)) {
          rows.push({
            cellId,
            code,
            name: stock?.name || "Код не найден в выгрузке",
            qty: stock?.qty ?? 0,
            found: !!stock,
          });
        }
      });
    });
    return rows;
  }, [search, manualMap, stockMap]);

  async function saveCellCodes() {
    setSaving(true);
    const codes = Array.from(
      new Set(
        cellEditor
          .split(/\n|,|;|\s+/)
          .map((item) => normalizeCode(item))
          .filter(Boolean)
      )
    );

    const { error: deleteError } = await supabase.from("cell_codes").delete().eq("cell_id", selectedCell);
    if (deleteError) {
      alert(`Ошибка удаления старых кодов: ${deleteError.message}`);
      setSaving(false);
      return;
    }

    if (codes.length > 0) {
      const rows = codes.map((code) => ({ cell_id: selectedCell, code }));
      const { error: insertError } = await supabase.from("cell_codes").insert(rows);
      if (insertError) {
        alert(`Ошибка сохранения кодов: ${insertError.message}`);
        setSaving(false);
        return;
      }
    }

    setManualMap((prev) => ({ ...prev, [selectedCell]: codes }));
    setSaving(false);
  }

  async function clearCellCodes() {
    setSaving(true);
    const { error } = await supabase.from("cell_codes").delete().eq("cell_id", selectedCell);
    if (error) {
      alert(`Ошибка очистки ячейки: ${error.message}`);
      setSaving(false);
      return;
    }
    setCellEditor("");
    setManualMap((prev) => ({ ...prev, [selectedCell]: [] }));
    setSaving(false);
  }

  async function handleStockFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  parseWorkbook(file, async (rows) => {
    const normalized = rows
    .map(normalizeStockRow)
    .filter((item) => item.code && item.name);

    if (normalized.length === 0) {
      alert("Файл прочитан, но не найдено ни одной строки с кодом. Проверьте колонки 'Код' и 'Наименование'.");
      return;
    }

    // Объединяем одинаковые коды
    const mergedMap = new Map();

    normalized.forEach((item) => {
      const existing = mergedMap.get(item.code);

      if (existing) {
        existing.qty += Number(item.qty || 0);
        if (!existing.name && item.name) {
          existing.name = item.name;
        }
      } else {
        mergedMap.set(item.code, {
          code: item.code,
          name: item.name,
          qty: Number(item.qty || 0),
        });
      }
    });

    const merged = Array.from(mergedMap.values());

    const { error: deleteError } = await supabase
      .from("stock_items")
      .delete()
      .gte("id", 0);

    if (deleteError) {
      alert(`Ошибка очистки stock_items: ${deleteError.message}`);
      return;
    }

    const chunks = [];
    for (let i = 0; i < merged.length; i += 500) {
      chunks.push(merged.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const payload = chunk.map((item) => ({
        code: item.code,
        name: item.name,
        qty: item.qty,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("stock_items").insert(payload);

      if (error) {
        alert(`Ошибка загрузки остатков: ${error.message}`);
        return;
      }
    }

    setStocks(merged);
    setLastSync(`Остатки загружены: ${new Date().toLocaleString()}`);
    alert(`Загрузка завершена. Загружено кодов: ${merged.length}`);
  });
}

  function exportMap() {
    const rows = [];
    Object.entries(manualMap).forEach(([cellId, codes]) => {
      codes.forEach((code) => rows.push({ cell_id: cellId, code }));
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "map");
    XLSX.writeFile(workbook, "warehouse-manual-map.xlsx");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <MapPinned className="h-6 w-6" /> Склад по ячейкам
              </CardTitle>
              <CardDescription>
                Вы вручную заносите коды в ячейки. Приложение подтягивает из общей базы наименование и остаток по коду.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2 rounded-2xl border bg-white p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Upload className="h-4 w-4" /> Загрузить остатки
                  </div>
                  <Input type="file" accept=".xls,.xlsx,.csv" onChange={handleStockFile} />
                  <div className="text-xs text-slate-500">Берем колонки: Код, Наименование, Остаток или Доступно</div>
                </label>
                <div className="grid gap-2 rounded-2xl border bg-white p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Download className="h-4 w-4" /> Экспорт карты
                  </div>
                  <Button variant="outline" className="justify-start rounded-xl" onClick={exportMap}>
                    Скачать ячейки и коды
                  </Button>
                  <div className="text-xs text-slate-500">Файл Excel с колонками cell_id и code</div>
                </div>
                <div className="grid gap-2 rounded-2xl border bg-white p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <RefreshCw className="h-4 w-4" /> Сервис
                  </div>
                  <Button variant="outline" className="justify-start rounded-xl" onClick={loadData}>
                    Обновить из базы
                  </Button>
                  <div className="text-xs text-slate-500">{lastSync}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <MetricCard icon={Package2} label="Ячеек" value={String(allCells.length)} />
                <MetricCard icon={Package2} label="Кодов в карте" value={String(totalMappedCodes)} />
                <MetricCard icon={Package2} label="Остаток всего" value={String(totalStockQty)} />
                <MetricCard icon={AlertCircle} label="Не найдено" value={String(unmatchedCodes.length)} />
                <MetricCard icon={AlertCircle} label="Без ячейки" value={String(stocksWithoutCell.length)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Поиск</CardTitle>
              <CardDescription>По коду, ячейке или наименованию</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl pl-9"
                  placeholder="Например: 11211 или A1-1"
                />
              </div>
              <ScrollArea className="h-[220px] rounded-2xl border bg-white p-3">
                <div className="grid gap-2">
                  {!search && <div className="text-sm text-slate-500">Введите запрос для поиска.</div>}
                  {search && searchResults.length === 0 && <div className="text-sm text-slate-500">Ничего не найдено.</div>}
                  {searchResults.map((item) => (
                    <button
                      key={`${item.cellId}-${item.code}`}
                      onClick={() => setSelectedCell(item.cellId)}
                      className="rounded-xl border p-3 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{item.code}</div>
                        <Badge variant="secondary">{item.cellId}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{item.name}</div>
                      <div className="mt-2 text-xs text-slate-500">Остаток: {item.qty}</div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Схема склада 4 × 6 × 4</CardTitle>
              <CardDescription>Нажмите на ячейку, затем вручную впишите коды для нее справа.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {RACKS.map((rack) => (
                <div key={rack} className="grid gap-2">
                  <div className="text-lg font-semibold">Стеллаж {rack}</div>
                  <div className="grid grid-cols-6 gap-2">
                    {COLUMNS.map((column) => (
                      <div key={`${rack}-${column}`} className="grid gap-2">
                        <div className="text-center text-sm font-medium text-slate-500">Колонка {column}</div>
                        {ROWS.map((row) => {
                          const cellId = `${rack}${column}-${row}`;
                          const codes = manualMap[cellId] || [];
                          const items = codes.map((code) => {
                            const stock = stockMap.get(code);
                            return { code, found: !!stock, qty: stock?.qty ?? 0 };
                          });
                          const status = getCellStatus(items);
                          const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
                          return (
                            <motion.button
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.99 }}
                              key={cellId}
                              onClick={() => setSelectedCell(cellId)}
                              className={[
                                "min-h-[84px] rounded-2xl border p-3 text-left shadow-sm transition",
                                statusClasses(status),
                                selectedCell === cellId ? "ring-2 ring-slate-900" : "",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold">{cellId}</div>
                                <Badge variant="outline" className="bg-white/70">{codes.length}</Badge>
                              </div>
                              <div className="mt-2 text-xs">Ряд {row}</div>
                              <div className="mt-1 text-xs">Остаток: {totalQty}</div>
                            </motion.button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedCell}</CardTitle>
              <CardDescription>
                {allCells.find((c) => c.cell_id === selectedCell)?.title || "Выбранная ячейка"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-sm font-semibold">Коды в ячейке</div>
                <Textarea
                  value={cellEditor}
                  onChange={(e) => setCellEditor(e.target.value)}
                  className="min-h-[150px] rounded-2xl"
                  placeholder={"Введите коды по одному в строке\nНапример:\n11211\n11218\n16651"}
                />
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-xl" onClick={saveCellCodes} disabled={saving || loading}>
                    <Save className="mr-2 h-4 w-4" /> {saving ? "Сохраняю..." : "Сохранить коды"}
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={clearCellCodes} disabled={saving || loading}>
                    <Trash2 className="mr-2 h-4 w-4" /> Очистить ячейку
                  </Button>
                </div>
                <div className="text-xs text-slate-500">
                  Разделители допустимы любые: новая строка, пробел, запятая или точка с запятой.
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <StatCard label="Кодов" value={String(cellItems.length)} />
                <StatCard label="Общий остаток" value={String(totalQtyInCell)} />
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Найденные товары</div>
                <ScrollArea className="h-[260px] rounded-2xl border bg-white p-3">
                  <div className="grid gap-2">
                    {cellItems.length === 0 && <div className="text-sm text-slate-500">В ячейке пока нет кодов.</div>}
                    {cellItems.map((item) => (
                      <div
                        key={item.code}
                        className={[
                          "rounded-xl border p-3",
                          item.found ? "border-slate-200" : "border-red-200 bg-red-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{item.code}</div>
                          <Badge variant={item.found ? "secondary" : "destructive"}>Остаток: {item.qty}</Badge>
                        </div>
                        <div className="mt-1 text-sm text-slate-700">{item.name}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Коды без совпадения в выгрузке</CardTitle>
              <CardDescription>Эти коды вручную внесены в ячейки, но в текущем файле остатков не найдены.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {unmatchedCodes.length === 0 && <div className="text-sm text-slate-500">Ошибок нет.</div>}
                {unmatchedCodes.map((item) => (
                  <div key={`${item.cellId}-${item.code}`} className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{item.code}</div>
                      <Badge variant="destructive">{item.cellId}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">Нет строки с таким кодом в загруженной выгрузке</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Товары в остатках без ячейки</CardTitle>
              <CardDescription>Эти товары есть в загруженной выгрузке, но вы еще не назначили им ячейку.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-2xl border bg-white p-3">
                <div className="grid gap-2">
                  {stocksWithoutCell.length === 0 && <div className="text-sm text-slate-500">Все товары из выгрузки распределены по ячейкам.</div>}
                  {stocksWithoutCell.map((item) => (
                    <div key={item.code} className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{item.code}</div>
                        <Badge variant="outline">Остаток: {item.qty}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{item.name}</div>
                      <div className="mt-2 text-xs text-slate-500">Ячейка не назначена</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
