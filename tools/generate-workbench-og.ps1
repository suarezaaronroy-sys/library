Add-Type -AssemblyName System.Drawing

$OutDir = Join-Path $PSScriptRoot "..\assets\og\workbench"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$W = 1200
$H = 630
$Paper = [System.Drawing.ColorTranslator]::FromHtml("#f5f2ec")
$Paper2 = [System.Drawing.ColorTranslator]::FromHtml("#ede9e0")
$Ink = [System.Drawing.ColorTranslator]::FromHtml("#1c1917")
$Ink2 = [System.Drawing.ColorTranslator]::FromHtml("#44403c")
$Ink3 = [System.Drawing.ColorTranslator]::FromHtml("#78716c")
$Teal = [System.Drawing.ColorTranslator]::FromHtml("#0d9488")
$Accent = [System.Drawing.ColorTranslator]::FromHtml("#c2410c")
$Line = [System.Drawing.Color]::FromArgb(34, 28, 25, 23)
$LineStrong = [System.Drawing.Color]::FromArgb(72, 28, 25, 23)

$Serif = New-Object System.Drawing.Font("Georgia", 54, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$SerifSmall = New-Object System.Drawing.Font("Georgia", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$Sans = New-Object System.Drawing.Font("Arial", 25, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$SansSmall = New-Object System.Drawing.Font("Arial", 19, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$Mono = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$MonoSmall = New-Object System.Drawing.Font("Consolas", 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$MonoBold = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$Cards = @(
  @{ File = "desk.png"; Title = "Operator Workbench"; Subtitle = "Small local-first tools for recurring operational work."; Chips = @("desk", "local-first", "operating memory"); Lines = @("Billing", "Scheduling", "Reporting", "Writing", "Whiteboard") },
  @{ File = "billing.png"; Title = "Billing Workspace"; Subtitle = "Invoice calendar, rate calculator, currency estimates, and copy-ready summaries."; Chips = @("invoice", "rate", "currency", "export"); Lines = @("Cross-month periods", "Manual exchange rates", "Invoice summary", "Personal budget", "Calculator") },
  @{ File = "scheduling.png"; Title = "Scheduling Workspace"; Subtitle = "Clock, stopwatch, countdowns, timezone overlap, and remote-work world time."; Chips = @("clock", "timezone", "remote"); Lines = @("World time", "Working overlap", "Stopwatch", "Countdowns", "Meeting windows") },
  @{ File = "marketing.png"; Title = "Marketing Workspace"; Subtitle = "Campaign naming, UTM construction, funnel math, and ROI models."; Chips = @("utm", "funnel", "roi"); Lines = @("Campaign brief", "UTM builder", "ROI calculator", "Funnel patterns", "Source notes") },
  @{ File = "crm.png"; Title = "CRM Workspace"; Subtitle = "Pipeline simulation, workflow mapping, JSON, regex, and request diagnostics."; Chips = @("pipeline", "json", "webhook"); Lines = @("Pipeline simulator", "Flowchart builder", "JSON formatter", "Regex tester", "API tester") },
  @{ File = "reporting.png"; Title = "Reporting Workspace"; Subtitle = "Status reports, handoffs, checklist reminders, priorities, and date-tagged notes."; Chips = @("reports", "checklists", "reminders", "handoff"); Lines = @("Shift close", "Task status", "Handoff", "Meeting debrief", "Checklist reminders") },
  @{ File = "writing.png"; Title = "Writing Workspace"; Subtitle = "Formatted notepad, snippets, text cleanup, and Markdown preview."; Chips = @("notes", "markdown", "snippets"); Lines = @("Scratchpad", "Clipboard", "Text utilities", "Snippets", "Markdown preview") },
  @{ File = "library-tools.png"; Title = "Library Tools"; Subtitle = "Grimoire and Note builders, metadata, and related-link helpers."; Chips = @("library", "metadata", "publishing"); Lines = @("Grimoire builder", "Note builder", "Metadata", "Related links", "Archive prep") },
  @{ File = "decisions.png"; Title = "Decision Workspace"; Subtitle = "Decision records, changed beliefs, outcomes, and future review."; Chips = @("decisions", "beliefs", "review"); Lines = @("Decision journal", "Belief revision", "What changed", "Why changed", "Review later") },
  @{ File = "whiteboard.png"; Title = "Whiteboard"; Subtitle = "Editable flow starters for quick mapping, dry runs, and meeting explanations."; Chips = @("flowchart", "pipeline", "dry run"); Lines = @("Blank map", "Pipeline", "Automation", "BPMN", "Mind map") },
  @{ File = "resources.png"; Title = "Resource Hub"; Subtitle = "Curated tools, private notes, favorites, recents, and searchable metadata."; Chips = @("resources", "tools", "notes"); Lines = @("Registry", "Favorites", "Private notes", "Quick tools", "Export memory") }
)

function Brush($Color) {
  return New-Object System.Drawing.SolidBrush($Color)
}

function Pen($Color, $Width = 1) {
  return New-Object System.Drawing.Pen($Color, $Width)
}

function Draw-WrappedText($G, $Text, $Font, $Brush, $X, $Y, $Width, $LineHeight, $MaxLines) {
  $Words = $Text -split "\s+"
  $Line = ""
  $Lines = New-Object System.Collections.Generic.List[string]
  foreach ($Word in $Words) {
    $Try = if ($Line) { "$Line $Word" } else { $Word }
    if ($G.MeasureString($Try, $Font).Width -le $Width) {
      $Line = $Try
    } else {
      if ($Line) { $Lines.Add($Line) }
      $Line = $Word
    }
  }
  if ($Line) { $Lines.Add($Line) }
  $Count = [Math]::Min($MaxLines, $Lines.Count)
  for ($I = 0; $I -lt $Count; $I++) {
    $G.DrawString($Lines[$I], $Font, $Brush, $X, $Y + ($I * $LineHeight))
  }
}

function Draw-Chip($G, $Text, $X, $Y) {
  $PadX = 17
  $TextSize = $G.MeasureString($Text.ToUpperInvariant(), $MonoSmall)
  $Rect = [System.Drawing.RectangleF]::new([single]$X, [single]$Y, [single]($TextSize.Width + ($PadX * 2)), [single]32)
  $G.FillRectangle((Brush ([System.Drawing.Color]::FromArgb(210, 255, 255, 255))), $Rect)
  $G.DrawRectangle((Pen $LineStrong), [int]$Rect.X, [int]$Rect.Y, [int]$Rect.Width, [int]$Rect.Height)
  $G.DrawString($Text.ToUpperInvariant(), $MonoSmall, (Brush $Ink3), $X + $PadX, $Y + 7)
  return [single]($Rect.Width + 10)
}

function Draw-Card($Card) {
  $Bmp = New-Object System.Drawing.Bitmap($W, $H)
  $G = [System.Drawing.Graphics]::FromImage($Bmp)
  $G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $G.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $G.Clear($Paper)

  for ($X = 0; $X -le $W; $X += 26) { $G.DrawLine((Pen $Line), $X, 0, $X, $H) }
  for ($Y = 0; $Y -le $H; $Y += 26) { $G.DrawLine((Pen $Line), 0, $Y, $W, $Y) }
  for ($X = 0; $X -le $W; $X += 104) { $G.DrawLine((Pen ([System.Drawing.Color]::FromArgb(26, 28, 25, 23))), $X, 0, $X, $H) }
  for ($Y = 0; $Y -le $H; $Y += 104) { $G.DrawLine((Pen ([System.Drawing.Color]::FromArgb(26, 28, 25, 23))), 0, $Y, $W, $Y) }

  $G.FillRectangle((Brush ([System.Drawing.Color]::FromArgb(245, 255, 253, 248))), 58, 58, 1084, 514)
  $G.DrawRectangle((Pen $Ink 2), 58, 58, 1084, 514)

  $G.DrawString("AARON SUAREZ / OPERATOR WORKBENCH", $Mono, (Brush $Teal), 90, 92)
  $G.DrawLine((Pen $Ink 2), 90, 128, 1110, 128)
  $G.DrawString("LOCAL-FIRST / COPY-READY / FIELD NOTES", $MonoSmall, (Brush $Ink3), 838, 92)

  $G.DrawString($Card.Title, $Serif, (Brush $Ink), 90, 168)
  Draw-WrappedText $G $Card.Subtitle $Sans (Brush $Ink2) 94 248 610 34 3

  $ChipX = 94
  foreach ($Chip in $Card.Chips) {
    $ChipX += (Draw-Chip $G $Chip $ChipX 352)
  }

  $G.DrawString("WORKSPACE URL", $MonoSmall, (Brush $Ink3), 94, 430)
  $Path = "/library/workbench/" + ($Card.File -replace "\.png$", "") + "/"
  if ($Card.File -eq "desk.png") { $Path = "/library/workbench/" }
  if ($Card.File -eq "whiteboard.png") { $Path = "/library/workbench/whiteboard/" }
  if ($Card.File -eq "library-tools.png") { $Path = "/library/workbench/library-tools/" }
  $G.DrawString($Path, $MonoBold, (Brush $Ink), 94, 458)

  $PanelX = 760
  $PanelY = 168
  $G.FillRectangle((Brush $Paper2), $PanelX, $PanelY, 320, 326)
  $G.DrawRectangle((Pen $LineStrong), $PanelX, $PanelY, 320, 326)
  $G.DrawString("TOOL SURFACE", $MonoSmall, (Brush $Teal), $PanelX + 24, $PanelY + 24)
  $RowY = $PanelY + 64
  $I = 1
  foreach ($LineItem in $Card.Lines) {
    $G.DrawLine((Pen $LineStrong), $PanelX + 24, $RowY + 34, $PanelX + 296, $RowY + 34)
    $G.DrawString(("{0:00}" -f $I), $MonoSmall, (Brush $Teal), $PanelX + 24, $RowY + 7)
    Draw-WrappedText $G $LineItem $SansSmall (Brush $Ink2) ($PanelX + 72) ($RowY + 5) 205 24 1
    $RowY += 48
    $I++
  }

  $G.DrawLine((Pen $Accent 4), 750, 520, 1090, 260)
  $G.DrawString("EVERYTHING I BUILD, I WRITE DOWN.", $MonoSmall, (Brush $Ink3), 90, 532)

  $PathOut = Join-Path $OutDir $Card.File
  $Bmp.Save($PathOut, [System.Drawing.Imaging.ImageFormat]::Png)
  $G.Dispose()
  $Bmp.Dispose()
}

foreach ($Card in $Cards) {
  Draw-Card $Card
}

Write-Host "Generated $($Cards.Count) Workbench OG images in $OutDir"
