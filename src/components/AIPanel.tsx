import { useMemo, useRef, useState } from 'react'
import { Mic2, Sparkles, ScanLine, Stethoscope } from 'lucide-react'
import type { AppState } from '../lib/types'
import { DAYS } from '../lib/schedule'
import { extractInlineData, extractJsonFromText, extractTextFromGemini, geminiGenerateContent } from '../lib/gemini'
import { Button, Card, Input, Select } from './ui'
import { useToast } from './Toast'

function fileToBase64Data(file: File): Promise<{ mime: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const res = String(reader.result || '')
      const m = res.match(/^data:(.+?);base64,(.+)$/)
      if (!m) return reject(new Error('图片编码失败'))
      resolve({ mime: m[1], data: m[2] })
    }
    reader.readAsDataURL(file)
  })
}

export function AIPanel(props: {
  state: AppState
  onImportPartialState: (partial: Partial<Omit<AppState, 'hasLoaded'>>) => void
}) {
  const toast = useToast()
  const [apiKey, setApiKey] = useState(() => String(localStorage.getItem('gemini_api_key') || ''))
  const [model, setModel] = useState('gemini-2.0-flash')
  const [diagnosticText, setDiagnosticText] = useState('')
  const [outlineText, setOutlineText] = useState('')
  const [ttsDay, setTtsDay] = useState<string>(DAYS[0]?.id || 'mon')
  const [ttsText, setTtsText] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const courseNames = useMemo(
    () => Array.from(new Set(props.state.courses.map((c) => String(c.name)).filter((x) => x.trim().length > 0))),
    [props.state.courses],
  )

  const saveKey = (v: string) => {
    const key = String(v)
    setApiKey(key)
    localStorage.setItem('gemini_api_key', key)
  }

  const scheduleDigest = useMemo(() => {
    const teachers = props.state.teachers.map((t) => ({ id: t.id, name: t.name, subject: t.subject }))
    const classes = props.state.classes.map((c) => ({ id: c.id, name: c.name }))
    const periods = props.state.periods.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime, endTime: p.endTime }))
    const totalUnits = Object.values(props.state.schedule).reduce((acc, arr) => acc + (arr?.length || 0), 0)
    return { teachers, classes, periods, totalUnits }
  }, [props.state])

  const runDiagnostic = async () => {
    try {
      setDiagnosticText('')
      const prompt = `你是走班排课系统的教务诊断助手。请根据输入的课表摘要：\n1) 判断排课密度是否过高/不均；\n2) 判断老师连堂强度与可能的疲劳风险；\n3) 给出 5 条中文可执行建议。\n\n输出为中文，使用小标题 + 项目符号。\n\n课表摘要 JSON：\n${JSON.stringify(scheduleDigest, null, 2)}`

      const resp = await geminiGenerateContent({ apiKey, model, parts: [{ text: prompt }] })
      const text = extractTextFromGemini(resp)
      setDiagnosticText(text)
      toast.push({ type: 'success', title: '诊断完成' })
    } catch (e: any) {
      const msg = String(e?.message || e)
      toast.push({
        type: 'error',
        title: '诊断失败',
        detail: msg.includes('Failed to fetch') ? '网络/代理未配置（需通过 /api/gemini 代理访问）' : msg,
      })
    }
  }

  const runOutline = async () => {
    try {
      setOutlineText('')
      const prompt = `请为一节 45 分钟课程生成教学要点（中文）：\n- 老师科目：${String(
        props.state.teachers[0]?.subject || '未指定',
      )}\n- 分组/课程名：${String(courseNames[0] || '走班')}
\n\n要求：\n- 输出 1 份 45 分钟节奏（导入/讲解/练习/反馈/作业），每段给出分钟数；\n- 给出 6 条板书/关键概念；\n- 给出 3 个课堂提问（由浅入深）。`

      const resp = await geminiGenerateContent({ apiKey, model, parts: [{ text: prompt }] })
      const text = extractTextFromGemini(resp)
      setOutlineText(text)
      toast.push({ type: 'success', title: '已生成教学要点' })
    } catch (e: any) {
      const msg = String(e?.message || e)
      toast.push({
        type: 'error',
        title: '生成失败',
        detail: msg.includes('Failed to fetch') ? '网络/代理未配置（需通过 /api/gemini 代理访问）' : msg,
      })
    }
  }

  const runImageImport = async (file: File) => {
    try {
      const img = await fileToBase64Data(file)
      const system = `你是排课图片识别与结构化转换器。你必须只输出 JSON（不要附加解释）。\n目标 Schema：\n{\n  teachers: [{ id, name, subject }],\n  classes: [{ id, name }],\n  periods: [{ id, name, startTime, endTime }],\n  courses: [{ id, name, color }],\n  schedule: {\n    \"classId-day-periodId\": [{ id, teacherId, groupName }]\n  }\n}\n约束：\n- day 只能是 mon/tue/wed/thu/fri/sat/sun。\n- 时间格式 HH:MM。\n- id 可为任意字符串，但必须唯一。\n- 输出必须可被 JSON.parse 解析。`
      const prompt = `请识别这张课表图片，并转换为符合 Schema 的 JSON。若图片信息不足，请尽可能推断并保持字段存在（可留空字符串）。`

      const resp = await geminiGenerateContent({
        apiKey,
        model,
        system,
        parts: [
          { text: prompt },
          { inlineData: { mimeType: img.mime, data: img.data } },
        ],
      })

      const text = extractTextFromGemini(resp)
      const parsed = extractJsonFromText(text)
      if (!parsed || typeof parsed !== 'object') throw new Error('无法解析识别结果 JSON')
      props.onImportPartialState(parsed as any)
      toast.push({ type: 'success', title: '已导入识图结果', detail: '请检查并等待自动保存' })
    } catch (e: any) {
      const msg = String(e?.message || e)
      toast.push({
        type: 'error',
        title: '识图导入失败',
        detail: msg.includes('Failed to fetch') ? '网络/代理未配置（需通过 /api/gemini 代理访问）' : msg,
      })
    }
  }

  const runTTS = async () => {
    try {
      const dayLabel = DAYS.find((d) => d.id === ttsDay)?.label || ''
      const digest = `今天（${String(dayLabel)}）老师安排播报：\n` +
        props.state.teachers
          .map((t) => {
            const slots: string[] = []
            for (const p of props.state.periods) {
              for (const c of props.state.classes) {
                const key = `${c.id}-${ttsDay}-${p.id}`
                const units = props.state.schedule[key] ?? []
                for (const u of units) {
                  if (String(u.teacherId) === String(t.id)) {
                    slots.push(`${String(p.name)} ${String(c.name)} ${String(u.groupName)}`)
                  }
                }
              }
            }
            return `${String(t.name)}：${slots.length ? slots.join('；') : '无安排'}`
          })
          .join('\n')

      const text = ttsText.trim().length > 0 ? ttsText : digest

      const resp = await geminiGenerateContent({
        apiKey,
        model: 'gemini-2.5-flash-preview-tts',
        parts: [{ text }],
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede',
            },
          },
        },
      })
      const audio = extractInlineData(resp)
      if (!audio) throw new Error('未返回音频数据（inlineData）')
      const src = `data:${audio.mimeType};base64,${audio.data}`
      if (audioRef.current) {
        audioRef.current.src = src
        await audioRef.current.play()
      }
      toast.push({ type: 'success', title: '已开始播报' })
    } catch (e: any) {
      const msg = String(e?.message || e)
      toast.push({
        type: 'error',
        title: 'TTS 失败',
        detail: msg.includes('Failed to fetch') ? '网络/代理未配置（需通过 /api/gemini 代理访问）' : msg,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Gemini 设置" subtitle="API key 存在本机 localStorage；所有调用已启用指数退避重试">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">API Key</div>
            <Input
              value={apiKey}
              placeholder="粘贴 Gemini API key"
              onChange={(e) => saveKey(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">模型</div>
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-16 lg:grid-cols-3">
        <Card title="识图导入" subtitle="上传课表图片 → 解析成 Schema JSON 并写入本地状态">
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) runImageImport(f)
                e.currentTarget.value = ''
              }}
            />
            <div className="text-xs text-slate-600">建议：截图尽量清晰；导入后请在管理中心核对老师/节次。</div>
            <Button variant="primary" className="w-full" onClick={() => toast.push({ type: 'info', title: '请选择图片文件' })}>
              <ScanLine className="h-4 w-4" />
              上传并识别
            </Button>
          </div>
        </Card>

        <Card title="诊断分析" subtitle="分析排课密度与连堂强度，输出中文建议">
          <div className="space-y-3">
            <Button variant="primary" className="w-full" onClick={runDiagnostic}>
              <Stethoscope className="h-4 w-4" />
              开始诊断
            </Button>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs text-slate-800 ring-1 ring-slate-200">
              {diagnosticText ? String(diagnosticText) : '（等待生成）'}
            </pre>
          </div>
        </Card>

        <Card title="教学大纲" subtitle="基于科目与分组名生成 45 分钟教学要点（MVP）">
          <div className="space-y-3">
            <Button variant="primary" className="w-full" onClick={runOutline}>
              <Sparkles className="h-4 w-4" />
              生成要点
            </Button>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs text-slate-800 ring-1 ring-slate-200">
              {outlineText ? String(outlineText) : '（等待生成）'}
            </pre>
          </div>
        </Card>
      </div>

      <Card title="语音播报 (TTS)" subtitle="将今日日程合成音频并播放（需模型支持 inlineData 音频返回）">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr_180px]">
          <div>
            <div className="text-xs font-semibold text-slate-700">选择星期</div>
            <Select value={ttsDay} onChange={(e) => setTtsDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {String(d.label)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">可选自定义文本</div>
            <Input value={ttsText} placeholder="留空则自动播报今日排课摘要" onChange={(e) => setTtsText(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="primary" className="w-full" onClick={runTTS}>
              <Mic2 className="h-4 w-4" />
              播放
            </Button>
          </div>
        </div>
        <audio ref={audioRef} className="mt-4 w-full" controls />
      </Card>
    </div>
  )
}
