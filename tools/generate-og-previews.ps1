Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BaseUrl = "https://suarezaaronroy-sys.github.io/library"

$W = 1200
$H = 630
$Paper = [System.Drawing.ColorTranslator]::FromHtml("#f5f2ec")
$Paper2 = [System.Drawing.ColorTranslator]::FromHtml("#ede9e0")
$Card = [System.Drawing.ColorTranslator]::FromHtml("#fffdf8")
$Ink = [System.Drawing.ColorTranslator]::FromHtml("#1c1917")
$Ink2 = [System.Drawing.ColorTranslator]::FromHtml("#44403c")
$Ink3 = [System.Drawing.ColorTranslator]::FromHtml("#78716c")
$Line = [System.Drawing.Color]::FromArgb(34, 28, 25, 23)
$LineStrong = [System.Drawing.Color]::FromArgb(86, 28, 25, 23)

$Serif = [System.Drawing.Font]::new("Georgia", 58, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$SerifSmall = [System.Drawing.Font]::new("Georgia", 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$Sans = [System.Drawing.Font]::new("Arial", 25, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$SansSmall = [System.Drawing.Font]::new("Arial", 19, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$Mono = [System.Drawing.Font]::new("Consolas", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$MonoSmall = [System.Drawing.Font]::new("Consolas", 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$MonoBold = [System.Drawing.Font]::new("Consolas", 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

function Brush($Color) {
  return [System.Drawing.SolidBrush]::new($Color)
}

function Pen($Color, $Width = 1) {
  return [System.Drawing.Pen]::new($Color, $Width)
}

function Html-Decode($Value) {
  return [System.Web.HttpUtility]::HtmlDecode([string]$Value)
}

function Html-Encode($Value) {
  return [System.Web.HttpUtility]::HtmlEncode([string]$Value)
}

function Read-Text($Path) {
  return [System.IO.File]::ReadAllText((Join-Path $Root $Path))
}

function Write-Text($Path, $Text) {
  $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText((Join-Path $Root $Path), $Text, $Utf8NoBom)
}

function Ensure-Dir($Path) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $Path) | Out-Null
}

function Plain-Text($Value) {
  $Text = Html-Decode $Value
  $Text = $Text -replace "<[^>]+>", " "
  $Text = $Text -replace "\s+", " "
  return $Text.Trim()
}

function Slug-From-Path($Path) {
  return [System.IO.Path]::GetFileNameWithoutExtension($Path)
}

function Get-HtmlTitle($Text, $Fallback) {
  $Match = [regex]::Match($Text, "<meta\s+property=""og:title""\s+content=""([^""]*)""", "IgnoreCase")
  if ($Match.Success) { return Plain-Text $Match.Groups[1].Value }
  $Match = [regex]::Match($Text, "<title>(.*?)</title>", "IgnoreCase,Singleline")
  if ($Match.Success) { return Plain-Text $Match.Groups[1].Value }
  return $Fallback
}

function Get-HtmlDescription($Text, $Fallback) {
  $Match = [regex]::Match($Text, "<meta\s+name=""description""\s+content=""([^""]*)""", "IgnoreCase")
  if ($Match.Success) { return Plain-Text $Match.Groups[1].Value }
  $Match = [regex]::Match($Text, "<meta\s+property=""og:description""\s+content=""([^""]*)""", "IgnoreCase")
  if ($Match.Success) { return Plain-Text $Match.Groups[1].Value }
  return $Fallback
}

function Get-FrontMatterValue($Text, $Key, $Fallback) {
  $Pattern = "(?m)^" + [regex]::Escape($Key) + ":\s*""?([^""`r`n]+)""?\s*$"
  $Match = [regex]::Match($Text, $Pattern)
  if ($Match.Success) { return Plain-Text $Match.Groups[1].Value }
  return $Fallback
}

function Draw-WrappedText($G, $Text, $Font, $Brush, $X, $Y, $Width, $LineHeight, $MaxLines) {
  $Words = ([string]$Text) -split "\s+"
  $LineText = ""
  $Lines = [System.Collections.Generic.List[string]]::new()
  foreach ($Word in $Words) {
    $Try = if ($LineText) { "$LineText $Word" } else { $Word }
    if ($G.MeasureString($Try, $Font).Width -le $Width) {
      $LineText = $Try
    } else {
      if ($LineText) { $Lines.Add($LineText) }
      $LineText = $Word
    }
  }
  if ($LineText) { $Lines.Add($LineText) }
  $Count = [Math]::Min($MaxLines, $Lines.Count)
  for ($I = 0; $I -lt $Count; $I++) {
    $G.DrawString($Lines[$I], $Font, $Brush, $X, $Y + ($I * $LineHeight))
  }
}

function Draw-Chip($G, $Text, $X, $Y, $Accent) {
  $PadX = 15
  $TextValue = ([string]$Text).ToUpperInvariant()
  $TextSize = $G.MeasureString($TextValue, $MonoSmall)
  $Rect = [System.Drawing.RectangleF]::new([single]$X, [single]$Y, [single]($TextSize.Width + ($PadX * 2)), [single]31)
  $G.FillRectangle((Brush ([System.Drawing.Color]::FromArgb(226, 255, 255, 255))), $Rect)
  $G.DrawRectangle((Pen $LineStrong), [int]$Rect.X, [int]$Rect.Y, [int]$Rect.Width, [int]$Rect.Height)
  $G.DrawString($TextValue, $MonoSmall, (Brush $Accent), $X + $PadX, $Y + 7)
  return [single]($Rect.Width + 10)
}

function Draw-OgCard($Item) {
  $OutPath = Join-Path $Root $Item.Output
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($OutPath)) | Out-Null

  $Accent = [System.Drawing.ColorTranslator]::FromHtml($Item.Accent)
  $Bmp = [System.Drawing.Bitmap]::new($W, $H)
  $G = [System.Drawing.Graphics]::FromImage($Bmp)
  $G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $G.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $G.Clear($Paper)

  for ($X = 0; $X -le $W; $X += 26) { $G.DrawLine((Pen $Line), $X, 0, $X, $H) }
  for ($Y = 0; $Y -le $H; $Y += 26) { $G.DrawLine((Pen $Line), 0, $Y, $W, $Y) }
  for ($X = 0; $X -le $W; $X += 104) { $G.DrawLine((Pen ([System.Drawing.Color]::FromArgb(26, 28, 25, 23))), $X, 0, $X, $H) }
  for ($Y = 0; $Y -le $H; $Y += 104) { $G.DrawLine((Pen ([System.Drawing.Color]::FromArgb(26, 28, 25, 23))), 0, $Y, $W, $Y) }

  $G.FillRectangle((Brush ([System.Drawing.Color]::FromArgb(246, 255, 253, 248))), 58, 58, 1084, 514)
  $G.DrawRectangle((Pen $Ink 2), 58, 58, 1084, 514)

  $G.DrawString("AARON SUAREZ / THE WORKING LIBRARY", $Mono, (Brush $Accent), 90, 92)
  $G.DrawString(([string]$Item.Kind).ToUpperInvariant(), $MonoSmall, (Brush $Ink3), 835, 92)
  $G.DrawLine((Pen $Ink 2), 90, 128, 1110, 128)

  Draw-WrappedText $G $Item.Title $Serif (Brush $Ink) 92 162 640 60 3
  Draw-WrappedText $G $Item.Subtitle $Sans (Brush $Ink2) 96 362 610 32 3

  $ChipX = 96
  foreach ($Chip in $Item.Chips) {
    $ChipX += (Draw-Chip $G $Chip $ChipX 474 $Accent)
  }

  $PanelX = 760
  $PanelY = 168
  $G.FillRectangle((Brush $Paper2), $PanelX, $PanelY, 320, 326)
  $G.DrawRectangle((Pen $LineStrong), $PanelX, $PanelY, 320, 326)
  $G.DrawString(([string]$Item.PanelTitle).ToUpperInvariant(), $MonoSmall, (Brush $Accent), $PanelX + 24, $PanelY + 24)
  $RowY = $PanelY + 64
  $I = 1
  foreach ($LineItem in $Item.Lines) {
    $G.DrawLine((Pen $LineStrong), $PanelX + 24, $RowY + 34, $PanelX + 296, $RowY + 34)
    $G.DrawString(("{0:00}" -f $I), $MonoSmall, (Brush $Accent), $PanelX + 24, $RowY + 7)
    Draw-WrappedText $G $LineItem $SansSmall (Brush $Ink2) ($PanelX + 72) ($RowY + 5) 205 24 1
    $RowY += 48
    $I++
  }

  $G.DrawLine((Pen $Accent 4), 750, 520, 1090, 260)
  $G.DrawString("EVERYTHING I BUILD, I WRITE DOWN.", $MonoSmall, (Brush $Ink3), 90, 532)
  $DisplayPath = [string]$Item.Path
  if ($DisplayPath.Length -gt 42) {
    $DisplayPath = $DisplayPath.Substring(0, 39) + "..."
  }
  $G.DrawString($DisplayPath, $MonoBold, (Brush $Ink), 775, 532)

  $Bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $G.Dispose()
  $Bmp.Dispose()
}

function Set-FrontMatterImage($Path, $ImagePath) {
  $Text = Read-Text $Path
  if ($Text -notmatch "(?s)^---\r?\n(.*?)\r?\n---") { return }
  if ($Text -match "(?m)^image:\s*.+$") {
    $Text = [regex]::Replace($Text, "(?m)^image:\s*.+$", "image: $ImagePath", 1)
  } elseif ($Text -match "(?m)^permalink:\s*.+$") {
    $Text = [regex]::Replace($Text, "(?m)^(permalink:\s*.+)$", "`$1`nimage: $ImagePath", 1)
  } else {
    $Text = [regex]::Replace($Text, "(?s)^---\r?\n", "---`nimage: $ImagePath`n", 1)
  }
  Write-Text $Path $Text
}

function Upsert-Meta($Text, $Attr, $Name, $Content) {
  $Escaped = Html-Encode $Content
  $Pattern = "<meta\b(?=[^>]*\b" + $Attr + "=""" + [regex]::Escape($Name) + """)(?=[^>]*\bcontent=""[^""]*"")[^>]*>\s*"
  $Tag = "<meta $Attr=""$Name"" content=""$Escaped"">"
  $Text = [regex]::Replace($Text, $Pattern, "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $Anchor = [regex]::Match($Text, "<meta\s+name=""description""[^>]*>", "IgnoreCase")
  if ($Anchor.Success) {
    return $Text.Insert($Anchor.Index + $Anchor.Length, "`n$Tag")
  }
  $Head = [regex]::Match($Text, "<head[^>]*>", "IgnoreCase")
  if ($Head.Success) {
    return $Text.Insert($Head.Index + $Head.Length, "`n$Tag")
  }
  return $Text
}

function Set-StandaloneHtmlPreview($Path, $Title, $Description, $PageUrl, $ImageUrl, $Type) {
  $Text = Read-Text $Path
  $Text = Upsert-Meta $Text "property" "og:type" $Type
  $Text = Upsert-Meta $Text "property" "og:title" $Title
  $Text = Upsert-Meta $Text "property" "og:description" $Description
  $Text = Upsert-Meta $Text "property" "og:url" $PageUrl
  $Text = Upsert-Meta $Text "property" "og:image" $ImageUrl
  $Text = Upsert-Meta $Text "property" "og:image:width" "1200"
  $Text = Upsert-Meta $Text "property" "og:image:height" "630"
  $Text = Upsert-Meta $Text "name" "twitter:card" "summary_large_image"
  $Text = Upsert-Meta $Text "name" "twitter:title" $Title
  $Text = Upsert-Meta $Text "name" "twitter:description" $Description
  $Text = Upsert-Meta $Text "name" "twitter:image" $ImageUrl
  $Text = [regex]::Replace($Text, '("image"\s*:\s*)"[^"]*"', ('$1"' + $ImageUrl + '"'), 1)
  Write-Text $Path $Text
}

$Cards = [System.Collections.Generic.List[object]]::new()

$MainPages = @(
  @{ Path = "index.html"; Output = "assets/og/site/home.png"; Url = "/"; Title = "Aaron Suarez"; Subtitle = "Operational systems, manuals, field notes, and small tools for work that needs to keep making sense."; Kind = "Home"; Accent = "#c2410c"; Chips = @("systems", "manuals", "field notes"); Lines = @("Library", "Workbench", "Lab", "Notes", "Contact") },
  @{ Path = "about.html"; Output = "assets/og/site/about.png"; Url = "/about/"; Title = "About Aaron Suarez"; Subtitle = "Role-agnostic systems work across CRM, automation, payments, documentation, AI workflows, and operational continuity."; Kind = "About"; Accent = "#0d9488"; Chips = @("operator", "systems", "handoffs"); Lines = @("How I work", "What I build", "Operating memory", "Two doors", "Contact") },
  @{ Path = "projects.html"; Output = "assets/og/site/library.png"; Url = "/projects/"; Title = "The Library"; Subtitle = "Free grimoires on CRM, automation, AI workflows, SEO, payments, remote work, and organizational systems."; Kind = "Library"; Accent = "#4338ca"; Chips = @("grimoires", "ungated", "systems"); Lines = @("CRM", "Automation", "Payments", "AI operations", "Quiet trades") },
  @{ Path = "notes.html"; Output = "assets/og/site/notes.png"; Url = "/notes/"; Title = "Field Notes"; Subtitle = "Short operational notes on systems, automation, handoffs, documentation, and the work behind the work."; Kind = "Notes"; Accent = "#b45309"; Chips = @("notes", "signals", "memory"); Lines = @("CRM", "Operations", "Systems", "AI", "Documentation") },
  @{ Path = "contact.html"; Output = "assets/og/site/contact.png"; Url = "/contact/"; Title = "Contact Aaron Suarez"; Subtitle = "Roles, collaboration, writing, library questions, and selective operational systems engagements."; Kind = "Contact"; Accent = "#15803d"; Chips = @("roles", "collaboration", "writing"); Lines = @("Direct lane", "Studio lane", "Remote-first", "Evidence", "Next step") },
  @{ Path = "lab/index.html"; Output = "assets/og/lab/lab.png"; Url = "/lab/"; Title = "The Lab"; Subtitle = "Experimental builds shipped early and iterated in public: Sari2POS, trades CRM strategy, and civic comparison tools."; Kind = "Lab"; Accent = "#1d4ed8"; Chips = @("mvp", "prototype", "bench"); Lines = @("Sari2POS", "Trades CRM", "Politician tiers", "Service design", "Rough tools") }
)

foreach ($Page in $MainPages) {
  $Cards.Add([pscustomobject]@{
    Output = $Page.Output; Path = "/library$($Page.Url)"; Title = $Page.Title; Subtitle = $Page.Subtitle; Kind = $Page.Kind; Accent = $Page.Accent; Chips = $Page.Chips; Lines = $Page.Lines; PanelTitle = "Index"
  })
  Set-FrontMatterImage $Page.Path ("/" + $Page.Output)
}

$WorkbenchPages = @(
  @{ File = "workbench/index.html"; Output = "assets/og/workbench/desk.png"; Url = "/workbench/"; Title = "Operator Workbench"; Subtitle = "Small local-first tools for recurring operational work."; Chips = @("desk", "local-first", "memory"); Lines = @("Billing", "Scheduling", "Reporting", "Writing", "Whiteboard") },
  @{ File = "workbench/billing/index.html"; Output = "assets/og/workbench/billing.png"; Url = "/workbench/billing/"; Title = "Billing Workspace"; Subtitle = "Invoice calendar, rate calculator, currency estimates, and copy-ready summaries."; Chips = @("invoice", "rate", "export"); Lines = @("Cross-month periods", "Manual exchange", "Invoice summary", "Budget", "Calculator") },
  @{ File = "workbench/scheduling/index.html"; Output = "assets/og/workbench/scheduling.png"; Url = "/workbench/scheduling/"; Title = "Scheduling Workspace"; Subtitle = "Clock, stopwatch, countdowns, timezone overlap, and remote-work world time."; Chips = @("clock", "timezone", "remote"); Lines = @("World time", "Working overlap", "Stopwatch", "Countdowns", "Meeting windows") },
  @{ File = "workbench/reporting/index.html"; Output = "assets/og/workbench/reporting.png"; Url = "/workbench/reporting/"; Title = "Reporting Workspace"; Subtitle = "Status reports, handoffs, checklist reminders, priorities, and date-tagged notes."; Chips = @("reports", "checklists", "handoff"); Lines = @("Shift close", "Task status", "Handoff", "Debrief", "Reminders") },
  @{ File = "workbench/writing/index.html"; Output = "assets/og/workbench/writing.png"; Url = "/workbench/writing/"; Title = "Writing Workspace"; Subtitle = "Formatted notepad, snippets, text cleanup, and Markdown preview."; Chips = @("notes", "markdown", "snippets"); Lines = @("Scratchpad", "Clipboard", "Text utilities", "Snippets", "Preview") },
  @{ File = "workbench/marketing/index.html"; Output = "assets/og/workbench/marketing.png"; Url = "/workbench/marketing/"; Title = "Marketing Workspace"; Subtitle = "Campaign naming, UTM construction, funnel math, and ROI models."; Chips = @("utm", "funnel", "roi"); Lines = @("Campaign brief", "UTM builder", "ROI calculator", "Funnel patterns", "Source notes") },
  @{ File = "workbench/crm/index.html"; Output = "assets/og/workbench/crm.png"; Url = "/workbench/crm/"; Title = "CRM Workspace"; Subtitle = "Pipeline simulation, workflow mapping, JSON, regex, and request diagnostics."; Chips = @("pipeline", "json", "webhook"); Lines = @("Pipeline", "Flowchart", "JSON", "Regex", "API tester") },
  @{ File = "workbench/library-tools/index.html"; Output = "assets/og/workbench/library-tools.png"; Url = "/workbench/library-tools/"; Title = "Library Tools"; Subtitle = "Grimoire and Note builders, metadata, and related-link helpers."; Chips = @("library", "metadata", "publishing"); Lines = @("Grimoire builder", "Note builder", "Metadata", "Related links", "Archive prep") },
  @{ File = "workbench/decisions/index.html"; Output = "assets/og/workbench/decisions.png"; Url = "/workbench/decisions/"; Title = "Decision Workspace"; Subtitle = "Decision records, changed beliefs, outcomes, and future review."; Chips = @("decisions", "beliefs", "review"); Lines = @("Decision journal", "Belief revision", "What changed", "Why changed", "Review later") },
  @{ File = "workbench/canvas/index.html"; Output = "assets/og/workbench/whiteboard.png"; Url = "/workbench/whiteboard/"; Title = "Whiteboard"; Subtitle = "Editable flow starters for quick mapping, dry runs, and meeting explanations."; Chips = @("flowchart", "pipeline", "dry run"); Lines = @("Blank map", "Pipeline", "Automation", "BPMN", "Mind map") },
  @{ File = "workbench/resources/index.html"; Output = "assets/og/workbench/resources.png"; Url = "/workbench/resources/"; Title = "Resource Hub"; Subtitle = "Curated tools, private notes, favorites, recents, and searchable metadata."; Chips = @("resources", "tools", "notes"); Lines = @("Registry", "Favorites", "Private notes", "Quick tools", "Export memory") }
)

foreach ($Page in $WorkbenchPages) {
  $Cards.Add([pscustomobject]@{
    Output = $Page.Output; Path = "/library$($Page.Url)"; Title = $Page.Title; Subtitle = $Page.Subtitle; Kind = "Workbench"; Accent = "#0d9488"; Chips = $Page.Chips; Lines = $Page.Lines; PanelTitle = "Tool surface"
  })
  Set-FrontMatterImage $Page.File ("/" + $Page.Output)
}

$LabPages = @("lab/politician-tier-list.html", "lab/trades-crm.html", "lab/sari2pos.html")
foreach ($Path in $LabPages) {
  $Text = Read-Text $Path
  $Slug = Slug-From-Path $Path
  $Title = Get-HtmlTitle $Text $Slug
  $Description = Get-HtmlDescription $Text "A Lab prototype from the working library."
  $Output = "assets/og/lab/$Slug.png"
  $PagePath = "/library/lab/$Slug.html"
  $Cards.Add([pscustomobject]@{
    Output = $Output; Path = $PagePath; Title = $Title; Subtitle = $Description; Kind = "Lab prototype"; Accent = "#1d4ed8"; Chips = @("lab", "mvp", "prototype"); Lines = @("Problem frame", "Demo surface", "Operating logic", "Evidence", "Next iteration"); PanelTitle = "Blueprint"
  })
  Set-StandaloneHtmlPreview $Path $Title $Description ($BaseUrl + "/lab/$Slug.html") ($BaseUrl + "/" + $Output) "website"
}

$GrimoireFiles = Get-ChildItem (Join-Path $Root "grimoires") -Filter "*.html" | Sort-Object Name
foreach ($File in $GrimoireFiles) {
  $Rel = "grimoires/$($File.Name)"
  $Text = Read-Text $Rel
  $Slug = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
  $NumberMatch = [regex]::Match($Slug, "^(\d{3})")
  $Number = if ($NumberMatch.Success) { $NumberMatch.Groups[1].Value } else { "000" }
  $Title = Get-HtmlTitle $Text ("Grimoire $Number")
  $Title = $Title -replace "\s+[\|-]\s*Aaron Suarez$", ""
  $Description = Get-HtmlDescription $Text "A grimoire from the working library."
  $Output = "assets/og/grimoires/$Slug.png"
  $PagePath = "/library/grimoires/$($File.Name)"
  $Cards.Add([pscustomobject]@{
    Output = $Output; Path = $PagePath; Title = $Title; Subtitle = $Description; Kind = "Grimoire $Number"; Accent = "#c2410c"; Chips = @("grimoire", "manual", "field notes"); Lines = @("Context", "System", "Evidence", "Failure modes", "Use later"); PanelTitle = "Contents"
  })
  Set-StandaloneHtmlPreview $Rel $Title $Description ($BaseUrl + "/grimoires/$($File.Name)") ($BaseUrl + "/" + $Output) "article"
}

$NoteFiles = Get-ChildItem (Join-Path $Root "_notes") -Filter "*.md" | Sort-Object Name
foreach ($File in $NoteFiles) {
  $Rel = "_notes/$($File.Name)"
  $Text = Read-Text $Rel
  $Slug = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
  $Title = Get-FrontMatterValue $Text "title" $Slug
  $Description = Get-FrontMatterValue $Text "description" (Get-FrontMatterValue $Text "lede" "A field note from the working library.")
  $Category = Get-FrontMatterValue $Text "category" "Field Note"
  $Date = Get-FrontMatterValue $Text "date" "undated"
  $Output = "assets/og/notes/$Slug.png"
  $Cards.Add([pscustomobject]@{
    Output = $Output; Path = "/library/notes/$Slug/"; Title = $Title; Subtitle = $Description; Kind = "Note / $Category"; Accent = "#0d9488"; Chips = @("note", $Category, $Date); Lines = @("Observation", "Reasoning", "System effect", "Field memory", "Related work"); PanelTitle = "Field note"
  })
  Set-FrontMatterImage $Rel ("/" + $Output)
}

foreach ($Item in $Cards) {
  Draw-OgCard $Item
}

Write-Host "Generated $($Cards.Count) OG preview cards and updated page metadata."
