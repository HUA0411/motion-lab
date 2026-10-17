/* MOTION LAB · 交互地图（atlas.html）页面脚本
   - 数据全部内联（禁止 fetch，保证 file:// 双击可运行）
   - 搜索 + 12 展厅多选筛选，结果计数走 aria-live
   - 重排只动 transform / opacity：FLIP 位移（禁止动画 width / height）
   - 键盘：/ 聚焦搜索、↑↓ 在结果间移动、↵ 打开、Esc 清空
   所有时长与缓动都从 CSS token 读取，脚本内不自定义动效参数。 */
(function () {
  'use strict';

  /* ---------------- 展厅表（唯一真源：条目的所在页面由这里派生） ---------------- */
  var ZONES = [
    { key: 'A', name: '微交互', href: 'micro-interactions.html' },
    { key: 'B', name: '状态与反馈', href: 'states-feedback.html' },
    { key: 'C', name: '滚动叙事', href: 'scroll-motion.html' },
    { key: 'D', name: '页面转场', href: 'page-transitions.html' },
    { key: 'E', name: '导航模式', href: 'navigation.html' },
    { key: 'F', name: '表单交互', href: 'forms.html' },
    { key: 'G', name: '手势与拖拽', href: 'gestures.html' },
    { key: 'H', name: '运动物理', href: 'motion-physics.html' },
    { key: 'I', name: '反馈系统', href: 'feedback.html' },
    { key: 'J', name: '无障碍', href: 'accessibility.html' },
    { key: 'K', name: '数据可视化', href: 'data-viz.html' },
    { key: 'L', name: '设计系统', href: 'design-system.html' }
  ];

  /* ---------------- 120 个条目：z 展厅 / t 名称 / d 一句话 / g 关键参数标签 ---------------- */
  var ITEMS = [
    { id: 'A-01', z: 'A', t: '按压物理', d: '按下缩放 0.97，出 150ms、回 100ms，指针移出不打断当前动画。', g: ['transform', '--dur-fast', ':active'] },
    { id: 'A-02', z: 'A', t: '图标形变切换', d: '菜单与关闭共用一套路径，靠位移与旋转切换，不做透明度叠加。', g: ['SVG path', '--ease-snap', '--dur-base'] },
    { id: 'A-03', z: 'A', t: '开关滑块', d: '轨道颜色 150ms 过渡，滑块位移交给 snap 弹簧，随时可被打断。', g: ['spring snap 520/30/0.7', 'aria-checked', '--dur-fast'] },
    { id: 'A-04', z: 'A', t: '分段控件指示器', d: '选中指示器只用 transform 滑动，文字不因选中状态而重排。', g: ['transform', '--ease-snap', 'aria-pressed'] },
    { id: 'A-05', z: 'A', t: '复选框勾选', d: '勾用 stroke-dashoffset 在 150ms 内画完，取消时瞬时复位。', g: ['stroke-dashoffset', '--dur-fast', ':checked'] },
    { id: 'A-06', z: 'A', t: '磁吸按钮', d: '指针进入 6px 范围按钮跟随位移，离开后走标准弹簧归位。', g: ['data-magnetic="6"', 'spring standard 340/28/1', 'rAF'] },
    { id: 'A-07', z: 'A', t: '悬停抬升卡', d: '上移 4px 并加深一层阴影，不改尺寸、不动文档流。', g: ['transform', '--shadow-2', '--dur-base'] },
    { id: 'A-08', z: 'A', t: '复制成功态', d: '图标形变为对勾并 toast 播报，2s 后自动还原。', g: ['ML.copy', 'ML.UI.toast', '--dur-fast'] },
    { id: 'A-09', z: 'A', t: '按压涟漪', d: '由指针坐标生成圆心，扩散用 scale 而不是 width。', g: ['transform: scale', 'pointerdown', '--dur-slow'] },
    { id: 'A-10', z: 'A', t: '位移与不透明度分工', d: '大位移只给 transform，淡入淡出只给 opacity，互不兼职。', g: ['transform', 'opacity', '--ease-out-quint'] },

    { id: 'B-01', z: 'B', t: '空状态', d: '说清为什么是空的，并给出一个明确的下一步动作。', g: ['.panel', '--muted', '单一主动作'] },
    { id: 'B-02', z: 'B', t: '骨架屏', d: '超过 300ms 的等待才显示骨架，避免一闪而过的闪烁。', g: ['.skeleton', '300ms 阈值', 'CLS ≈ 0'] },
    { id: 'B-03', z: 'B', t: '错误态三重编码', d: '颜色 + 图标 + 文字同时表达错误，不让色觉障碍用户独自猜。', g: ['--danger', 'role="alert"', '内联 SVG'] },
    { id: 'B-04', z: 'B', t: '成功态', d: '成功提示保留 4s，可被下一次操作立即打断。', g: ['--success', '--dur-slow', '可打断'] },
    { id: 'B-05', z: 'B', t: '乐观更新', d: '先改 UI 再发请求，失败时回滚并提示可重试。', g: ['spring standard', '回滚', '--dur-base'] },
    { id: 'B-06', z: 'B', t: '重试与退避', d: '失败按钮变「重试」，间隔按 1s / 2s / 4s 递增。', g: ['ML.wait', '--dur-slow', 'aria-live'] },
    { id: 'B-07', z: 'B', t: '加载互斥', d: '请求期间禁用触发元素并标记 aria-busy，防重复提交。', g: ['disabled', 'aria-busy', '防重复'] },
    { id: 'B-08', z: 'B', t: '不确定进度', d: '时长未知时用 spinner，不用假进度条欺骗等待。', g: ['.spinner', '--dur-base', '诚实反馈'] },
    { id: 'B-09', z: 'B', t: '离线提示', d: '顶部持久条提示离线，恢复后自动消失并播报。', g: ['--warning', 'aria-live', '持久条'] },
    { id: 'B-10', z: 'B', t: '状态机可视化', d: 'idle / loading / success / error 四态用图形标出迁移路径。', g: ['内联 SVG', '--info', '状态机'] },

    { id: 'C-01', z: 'C', t: '视差四层', d: '四层背景分别 0.04 / 0.08 / 0.12 / 0.18，只用 translate3d。', g: ['data-parallax', 'translate3d', 'rAF'] },
    { id: 'C-02', z: 'C', t: '进入揭示', d: '阈值 0.15 触发，24px 上移配透明度收束。', g: ['IntersectionObserver', 'threshold 0.15', 'opacity'] },
    { id: 'C-03', z: 'C', t: '批量错开', d: '子项按 45ms 依次进入，超过 8 项后不再累加延迟。', g: ['--stagger 45ms', 'data-reveal-stagger', '--dur-slower'] },
    { id: 'C-04', z: 'C', t: '滚动进度条', d: '进度写入根元素变量，用 scaleX 绘制，永不触发重排。', g: ['--scroll-progress', 'scaleX', 'linear 可用于进度'] },
    { id: 'C-05', z: 'C', t: '吸顶标题', d: '区块标题钉在视口顶部，只用 transform 与层级切换。', g: ['position: sticky', '--z-sticky', 'transform'] },
    { id: 'C-06', z: 'C', t: '横向滚动墙', d: 'scroll-snap 配方向键与 Home / End，进度用进度条表示。', g: ['scroll-snap-type', '方向键', 'Home/End'] },
    { id: 'C-07', z: 'C', t: '分段叙事', d: '用 position: sticky 分段推进，绝不做滚动劫持。', g: ['position: sticky', '无 scroll-jacking', '--dur-base'] },
    { id: 'C-08', z: 'C', t: '数字滚动', d: '进入视口后从 0 数到目标值，tabular-nums 防抖动。', g: ['data-count', '.tnum', 'rAF'] },
    { id: 'C-09', z: 'C', t: '视差安全区', d: '文字层永不参与视差，位移只交给装饰层。', g: ['data-parallax', '可读性优先', '--muted'] },
    { id: 'C-10', z: 'C', t: '锚点平滑滚动', d: '锚点滚动尊重 reduced-motion，也不抢走正在聚焦的元素。', g: ['ML.scroll.to', 'scroll-behavior', ':focus'] },

    { id: 'D-01', z: 'D', t: '退出快于进入', d: '退出时长固定为进入的 0.68 倍，回退永远干脆。', g: ['--dur-exit', '--ease-in-quad', '0.68×'] },
    { id: 'D-02', z: 'D', t: '共享元素', d: '列表卡与详情页共享几何，用 FLIP 位移把两页接起来。', g: ['FLIP', 'transform', '--dur-slower'] },
    { id: 'D-03', z: 'D', t: '遮罩擦除', d: '用 clip-path 擦除旧页，不改文档流也不触发重排。', g: ['clip-path', '--ease-out-expo', '--dur-slow'] },
    { id: 'D-04', z: 'D', t: '转场不阻塞输入', d: '动画期间输入随时可用，新操作可以打断旧转场。', g: ['可打断', 'pointer-events', '无阻塞'] },
    { id: 'D-05', z: 'D', t: '转场三档降级', d: 'on 全量 / lite 仅淡出 / off 瞬时切换，三档都不破版。', g: ['data-motion', 'prefers-reduced-motion', '三档'] },
    { id: 'D-06', z: 'D', t: '骨架先行', d: '新页面先出骨架再填内容，让等待有形状。', g: ['.skeleton', '--dur-base', '首屏'] },
    { id: 'D-07', z: 'D', t: '返回保持位置', d: '从详情返回列表时恢复上次滚动位置，不让用户重新寻找。', g: ['history.scrollRestoration', '滚动恢复', '无跳动'] },
    { id: 'D-08', z: 'D', t: '方向感一致', d: '前进左移、后退右移，方向语义全站不许混用。', g: ['translateX', '--ease-in-out-quart', '--dur-slow'] },
    { id: 'D-09', z: 'D', t: '首屏同步类名', d: 'inline 脚本先给 html 打标记再渲染，杜绝首屏闪烁。', g: ['*.inline.js', '防 FOUC', '同步执行'] },
    { id: 'D-10', z: 'D', t: '跨页动效连续', d: '同一元素跨页保持同一条缓动，一致性本身就是高级感。', g: ['--ease-out-quint', '--dur-slower', '一致性'] },

    { id: 'E-01', z: 'E', t: '顶栏滚动状态', d: '滚过 24px 后加一条分隔线，不改高度、不抖动。', g: ['data-scrolled', '--hairline', '--z-header 40'] },
    { id: 'E-02', z: 'E', t: '移动抽屉', d: '焦点锁定在抽屉内，Esc 关闭后焦点归还触发按钮。', g: ['焦点锁定', 'Esc', '--z-drawer 60'] },
    { id: 'E-03', z: 'E', t: '命令面板', d: '⌘K 打开，↑↓ 选择，↵ 打开，Esc 关闭并还原焦点。', g: ['⌘K', 'role="listbox"', '--z-palette 90'] },
    { id: 'E-04', z: 'E', t: '全部展厅面板', d: '12 个展厅分组展开，箭头旋转 90° 表达开合状态。', g: ['aria-expanded', 'transform: rotate', '--dur-fast'] },
    { id: 'E-05', z: 'E', t: '底部 Tab 栏', d: '移动端四项导航，每项触控目标不小于 44px。', g: ['44px', '--z-sticky 10', '安全区'] },
    { id: 'E-06', z: 'E', t: '面包屑', d: '层级可回溯，末级用 aria-current 标记且不可点。', g: ['aria-current="page"', '层级', '--fs-sm'] },
    { id: 'E-07', z: 'E', t: '跳过导航', d: '页面第一个可聚焦元素，聚焦时出现在左上角。', g: ['.skip-link', ':focus-visible', '键盘优先'] },
    { id: 'E-08', z: 'E', t: '锚点目录', d: '长页右侧目录随滚动更新当前项，不遮挡正文。', g: ['IntersectionObserver', 'aria-current', '--z-sticky'] },
    { id: 'E-09', z: 'E', t: '导航高亮', d: '由 html 的 data-page 决定高亮项，不靠脚本猜路径。', g: ['data-page', 'aria-current', '唯一真源'] },
    { id: 'E-10', z: 'E', t: '焦点可见', d: '统一 2px accent 焦点环加 3px 偏移，两种主题下都清晰。', g: [':focus-visible', 'outline-offset 3px', '--accent'] },

    { id: 'F-01', z: 'F', t: '常驻标签', d: '用可见 label 而不是 placeholder 充当字段名。', g: ['<label for>', '--fs-sm', '可见标签'] },
    { id: 'F-02', z: 'F', t: '内联校验', d: '失焦后才校验，错误信息紧贴字段并配 aria-invalid。', g: ['aria-invalid', 'aria-describedby', 'blur'] },
    { id: 'F-03', z: 'F', t: '提交加载', d: '提交时禁用按钮并显示 spinner，按钮宽度不跳动。', g: ['disabled', '.spinner', '防重复'] },
    { id: 'F-04', z: 'F', t: '错误播报', d: '错误由 aria-live 播报，视觉与朗读两条路同时走。', g: ['role="alert"', 'aria-live', '--danger'] },
    { id: 'F-05', z: 'F', t: '密码强度', d: '强度用文字 + 条形 + 图标表达，不只换一个颜色。', g: ['--success', '--warning', '三重编码'] },
    { id: 'F-06', z: 'F', t: '数字步进', d: '步进按钮按住 400ms 后开始连发，单击保持精确。', g: ['pointerdown', '400ms', '--dur-fast'] },
    { id: 'F-07', z: 'F', t: '自动保存', d: '停止输入 800ms 后保存，用状态文字告知结果。', g: ['debounce 800ms', 'aria-live', '--muted'] },
    { id: 'F-08', z: 'F', t: '字符计数', d: '计数用等宽数字，接近上限时换成警告色并加提示语。', g: ['.tnum', '--warning', '--fs-label'] },
    { id: 'F-09', z: 'F', t: '多步分组', d: '每步一个标题与进度标记，随时可以退回上一步。', g: ['<fieldset>', 'aria-current="step"', '--dur-base'] },
    { id: 'F-10', z: 'F', t: '禁用原因', d: '禁用按钮旁给出原因文字，不让用户对着灰色按钮猜。', g: ['aria-disabled', '--muted', '文字说明'] },

    { id: 'G-01', z: 'G', t: '指针事件统一', d: '一套 pointerdown / move / up 同时覆盖鼠标、触屏与触控笔。', g: ['pointer events', 'setPointerCapture', '统一输入'] },
    { id: 'G-02', z: 'G', t: '拖拽阈值', d: '位移超过 4px 才判定为拖拽，避免点击被误读成拖动。', g: ['阈值 4px', 'pointermove', '误触防护'] },
    { id: 'G-03', z: 'G', t: '拖拽回弹', d: '越界后用 soft 弹簧回弹，不硬切回边界。', g: ['spring soft 170/24/1.2', 'ML.clamp', '--dur-slow'] },
    { id: 'G-04', z: 'G', t: '吸附对齐', d: '松手后吸附到最近档位，260ms 内完成对齐。', g: ['--ease-snap', '--dur-base', '吸附'] },
    { id: 'G-05', z: 'G', t: '惯性滑动', d: '用松手瞬间的速度作为初速度，手感连续不重启。', g: ['velocity', 'spring standard', 'rAF'] },
    { id: 'G-06', z: 'G', t: '长按菜单', d: '长按 500ms 弹出菜单，期间移动超过 8px 立即取消。', g: ['500ms', 'pointermove', '取消阈值 8px'] },
    { id: 'G-07', z: 'G', t: '双指缩放', d: '缩放夹在 0.8–2.5 之间，越界立刻回弹。', g: ['pointer events', 'ML.clamp', '0.8–2.5'] },
    { id: 'G-08', z: 'G', t: '画布涂鸦', d: '只重绘增量线段，不清空整个画布，避免闪烁。', g: ['<canvas>', 'rAF', '增量绘制'] },
    { id: 'G-09', z: 'G', t: '键盘等价操作', d: '任何拖拽都配一套方向键替代方案，键盘用户不缺席。', g: ['方向键', 'aria-valuenow', '键盘等价'] },
    { id: 'G-10', z: 'G', t: '触控目标间距', d: '相邻可点区域之间至少留 8px，防止误触邻项。', g: ['44px', '间距 ≥8px', '拇指友好'] },

    { id: 'H-01', z: 'H', t: '弹簧预设', d: 'snap / standard / soft / playful 四档按场景选用，不随手写参数。', g: ['ML.presets', 'spring', '四档'] },
    { id: 'H-02', z: 'H', t: '临界阻尼', d: 'damping ≥ 2√(k·m) 时不过冲；standard 的临界值是 36.9。', g: ['damping', 'ζ 阻尼比', '36.9 参考'] },
    { id: 'H-03', z: 'H', t: '打断重定向', d: '新目标从当前速度衔接，不回到起点重新起跑。', g: ['setTarget', 'velocity', '可打断'] },
    { id: 'H-04', z: 'H', t: '速度衔接', d: '打断时继承速度，避免速度断层造成的顿挫感。', g: ['velocity', 'rAF', '连续性'] },
    { id: 'H-05', z: 'H', t: '落点精度', d: '距目标 0.5px 内收敛并停止，不留无限逼近的循环。', g: ['restDelta', 'rAF', '收敛'] },
    { id: 'H-06', z: 'H', t: '等效时长', d: '弹簧按视觉落点换算成等效时长，方便与 CSS 过渡对齐。', g: ['--dur-base', '等效时长', '--ease-out-quint'] },
    { id: 'H-07', z: 'H', t: '硬件加速', d: '只动 transform / opacity / filter，把重排和重绘挡在门外。', g: ['GPU 合成', 'will-change 谨慎', '无重排'] },
    { id: 'H-08', z: 'H', t: '60fps 预算', d: '每帧预算 16.7ms，长任务拆到帧外，避免掉帧台阶。', g: ['16.7ms', 'rAF', '长任务拆分'] },
    { id: 'H-09', z: 'H', t: '弹簧曲线可视化', d: '曲线由真实积分点绘制，阻尼比与峰值都标在图上。', g: ['SVG path', 'ζ 阻尼比', '数值积分'] },
    { id: 'H-10', z: 'H', t: '大位移缓动', d: '跨屏位移改用 --ease-out-expo，前段更快、收尾更稳。', g: ['--ease-out-expo', '--dur-slower', '大位移'] },

    { id: 'I-01', z: 'I', t: 'Toast 上限', d: '同屏最多 4 条，超出时最旧的先退出。', g: ['4 条上限', '--z-toast 80', '--dur-exit'] },
    { id: 'I-02', z: 'I', t: '悬停暂停', d: '指针悬停在 toast 上时暂停倒计时，离开后继续。', g: ['hover 暂停', '--dur-slow', '可读性'] },
    { id: 'I-03', z: 'I', t: '危险确认', d: '危险操作二次确认，标题写清后果与不可逆性。', g: ['ML.UI.confirm', 'danger', '焦点锁定'] },
    { id: 'I-04', z: 'I', t: '失败可重试', d: '失败提示必须带一个可执行的重试出口。', g: ['重试', '--danger', 'aria-live'] },
    { id: 'I-05', z: 'I', t: '内联反馈', d: '字段级反馈紧贴字段，比全局 toast 更容易定位。', g: ['aria-describedby', '--fs-sm', '就近原则'] },
    { id: 'I-06', z: 'I', t: '加载按钮', d: '加载中禁用并显示进度，宽度保持不变、点击不漂移。', g: ['disabled', '.spinner', '无位移'] },
    { id: 'I-07', z: 'I', t: '通知层级', d: 'toast 在 z-80，永远压不住模态与命令面板。', g: ['--z-toast 80', '--z-modal 70', '层级表'] },
    { id: 'I-08', z: 'I', t: '不遮挡操作', d: '反馈浮层避开触控热区，移动端贴在安全区上方。', g: ['安全区', '--gutter', '触控友好'] },
    { id: 'I-09', z: 'I', t: '键盘可关闭', d: '每条 toast 都能被 Esc 关闭，且不抢走当前焦点。', g: ['Esc', 'role="status"', '不抢焦点'] },
    { id: 'I-10', z: 'I', t: '播报节流', d: '连续的状态变化合并为一次播报，避免屏幕阅读器被刷屏。', g: ['aria-live', '节流', '--dur-base'] },

    { id: 'J-01', z: 'J', t: '可见焦点环', d: '统一 2px accent 焦点环，偏移 3px，深浅主题都清晰。', g: [':focus-visible', '2px 焦点环', 'outline-offset 3px'] },
    { id: 'J-02', z: 'J', t: '触控目标', d: '所有可点元素不小于 44×44px，拇指不需要瞄准。', g: ['44px', '--space-3', '触控'] },
    { id: 'J-03', z: 'J', t: '动效三档', d: 'on / lite / off 三档可切换，并默认跟随系统设置。', g: ['data-motion', 'localStorage', '跟随系统'] },
    { id: 'J-04', z: 'J', t: '第二编码', d: '状态不只靠颜色，配图标、文字或纹理作为第二编码。', g: ['三重编码', '内联 SVG', '--danger'] },
    { id: 'J-05', z: 'J', t: '屏幕阅读器播报', d: '关键状态变化写入 aria-live 区域并保持原子播报。', g: ['aria-live', 'aria-atomic', 'role="status"'] },
    { id: 'J-06', z: 'J', t: '数字对齐', d: '所有数字列使用等宽数字，数值滚动时列宽不抖动。', g: ['.tnum', 'tabular-nums', '--font-mono'] },
    { id: 'J-07', z: 'J', t: '标题层级', d: '每页唯一 h1，层级不跳级，屏幕阅读器可当目录使用。', g: ['h1→h3', '语义结构', '不跳级'] },
    { id: 'J-08', z: 'J', t: '跳过导航', d: '首个可聚焦元素是跳过导航链接，直达 main。', g: ['.skip-link', '#main', '键盘优先'] },
    { id: 'J-09', z: 'J', t: '对比度达标', d: '正文对比度 ≥ 4.5:1，浅色模式的强调色单独换成 4.63:1。', g: ['--accent-strong', '4.5:1', '实测数值'] },
    { id: 'J-10', z: 'J', t: '键盘全流程', d: 'Tab / Shift+Tab / Enter / Space / Esc / 方向键走通全部交互。', g: ['键盘走查', '无焦点陷阱', '顺序一致'] },

    { id: 'K-01', z: 'K', t: '手写折线图', d: '折线用 viewBox + path 手绘，零图表库、零外部请求。', g: ['SVG path', 'viewBox', '零依赖'] },
    { id: 'K-02', z: 'K', t: '手写柱状图', d: '柱高按比例映射到坐标，刻度与网格只画必要的线。', g: ['SVG rect', '--info', '比例映射'] },
    { id: 'K-03', z: 'K', t: '环形进度', d: '用 stroke-dasharray 表达百分比，同时给出数字读数。', g: ['stroke-dasharray', '.tnum', '--accent'] },
    { id: 'K-04', z: 'K', t: '迷你走势图', d: '表格内的迷你走势只保留趋势，不画坐标轴。', g: ['sparkline', '--muted', '极简'] },
    { id: 'K-05', z: 'K', t: '数据变化动效', d: '数值变化由弹簧驱动，读数同步滚动，不闪跳。', g: ['spring standard', 'ML.springTo', 'rAF'] },
    { id: 'K-06', z: 'K', t: '坐标轴与刻度', d: '轴标签用 mono 且等宽数字，单位统一标在轴端。', g: ['--font-mono', '.tnum', '单位标注'] },
    { id: 'K-07', z: 'K', t: '非颜色编码', d: '序列区分用形状与直接标注，颜色只做辅助。', g: ['直接标注', '形状', '第二编码'] },
    { id: 'K-08', z: 'K', t: '图表三态', d: '加载、空数据、错误三种状态都要有明确的图形与文字。', g: ['.skeleton', '空数据', '--danger'] },
    { id: 'K-09', z: 'K', t: '表格与图形互补', d: '图给趋势、表给精确值，两者共享同一份数据源。', g: ['<table>', '同源数据', 'aria-label'] },
    { id: 'K-10', z: 'K', t: '数值格式化', d: '大数加千分位、小数定精度，全部走等宽数字。', g: ['.tnum', '千分位', '精度'] },

    { id: 'L-01', z: 'L', t: 'Token 唯一真源', d: '颜色、字号、间距、时长、缓动全部 token 化，组件不许写死。', g: [':root', 'var(--token)', '唯一真源'] },
    { id: 'L-02', z: 'L', t: '对比度实测', d: '每个前景 / 背景组合附实测对比度，浅色模式单独更换强调色。', g: ['4.5:1', '--accent-strong', '实测'] },
    { id: 'L-03', z: 'L', t: '排版阶梯', d: '八个字号档位配字重与字距，大标题负字距、标签正字距。', g: ['--fs-display', '--fs-label', 'letter-spacing'] },
    { id: 'L-04', z: 'L', t: '间距阶梯', d: '4pt 基准十级间距，断点固定为 375 / 768 / 1024 / 1440。', g: ['--space-1..10', '4pt', '4 个断点'] },
    { id: 'L-05', z: 'L', t: '圆角与发丝线', d: '六档圆角加统一 1px 发丝线，卡片只用一套描边。', g: ['--r-xs..pill', '--hairline', '--ink-600'] },
    { id: 'L-06', z: 'L', t: '层级表', d: 'z-index 从 0 到 100 分层编号，禁止出现 9999 这类魔法值。', g: ['--z-header 40', '--z-palette 90', '分层编号'] },
    { id: 'L-07', z: 'L', t: '动效开关', d: '三档动效在页头与页脚都能切换，并记忆到 localStorage。', g: ['data-motion', 'localStorage', '跟随系统'] },
    { id: 'L-08', z: 'L', t: '弹簧预设表', d: '四档弹簧附 stiffness / damping / mass 与是否过冲。', g: ['340/28/1', 'ζ 阻尼比', 'ML.presets'] },
    { id: 'L-09', z: 'L', t: '规格标注模板', d: '每个 demo 标注触发、时长、缓动、属性、降级五项，缺一不合格。', g: ['五段标注', 'dl.spec-table', '模板'] },
    { id: 'L-10', z: 'L', t: '验收清单', d: '交付前按清单逐项自检：宽度、键盘、主题、动效、链接。', g: ['验收清单', '4 个宽度', '站内链接'] }
  ];

  var ZONE_BY_KEY = {};
  var ZONE_ORDER = [];
  ZONES.forEach(function (zone) {
    ZONE_BY_KEY[zone.key] = zone;
    ZONE_ORDER.push(zone.key);
  });

  var DEBOUNCE_MS = 120;

  function isReduced() {
    var M = window.ML;
    return !M ? true : !!M.reduced;
  }

  function zoneOf(key) {
    return ZONE_BY_KEY[key] || { key: key, name: key, href: 'index.html' };
  }

  function tokenRaw(name) {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    return value ? value.trim() : '';
  }

  function tokenMs(name, fallback) {
    var value = parseFloat(tokenRaw(name));
    return isFinite(value) && value > 0 ? value : fallback;
  }

  /* 缓动取自 tokens.css；token 可能存的是裸控制点，这里统一成 cubic-bezier() */
  function tokenEase(name) {
    var value = tokenRaw(name);
    if (!value) { return 'cubic-bezier(.22,1,.36,1)'; }
    if (value.indexOf('cubic-bezier') === 0 || value.indexOf('linear') === 0 || value.indexOf('ease') === 0) {
      return value;
    }
    return 'cubic-bezier(' + value + ')';
  }

  function iconEl(name, size) {
    var UI = window.ML && window.ML.UI;
    if (!UI || typeof UI.icon !== 'function') { return null; }
    try {
      return UI.icon(name, { size: size });
    } catch (err) {
      return null;
    }
  }

  function boot() {
    var ML = window.ML;
    if (!ML || typeof ML.q !== 'function' || typeof ML.create !== 'function') { return; }

    var form = ML.q('#atl-filters');
    var input = ML.q('#atl-q');
    var chipsBox = ML.q('#atl-chips');
    var list = ML.q('#atl-list');
    var countEl = ML.q('#atl-count');
    var activeEl = ML.q('#atl-active');
    var emptyBox = ML.q('#atl-empty');
    var emptyWhy = ML.q('#atl-empty-why');
    var clearInput = ML.q('#atl-q-clear');
    var resetBtn = ML.q('#atl-reset');
    var emptyReset = ML.q('#atl-empty-reset');
    var topBtn = ML.q('#atl-top');
    if (!form || !input || !list) { return; }

    /* ---------- 建索引 + 渲染 ---------- */
    var rows = [];
    var frag = document.createDocumentFragment();

    ITEMS.forEach(function (item) {
      var zone = zoneOf(item.z);
      var hay = (item.id + ' ' + item.t + ' ' + item.d + ' ' + item.g.join(' ') + ' ' + item.z + ' ' + zone.name).toLowerCase();

      var li = ML.create('li', { class: 'atl-item', 'data-zone': item.z });
      var link = ML.create('a', { class: 'atl-item__link' });
      link.href = zone.href;
      link.tabIndex = -1;

      link.appendChild(ML.create('span', { class: 'atl-item__id tnum', text: item.id }));

      var main = ML.create('span', { class: 'atl-item__main' });
      main.appendChild(ML.create('span', { class: 'atl-item__title', text: item.t }));
      main.appendChild(ML.create('span', { class: 'atl-item__desc', text: item.d }));
      var tags = ML.create('span', { class: 'atl-item__tags' });
      item.g.forEach(function (tag) {
        tags.appendChild(ML.create('span', { class: 'chip mono tnum', text: tag }));
      });
      main.appendChild(tags);
      link.appendChild(main);

      link.appendChild(ML.create('span', { class: 'atl-item__zone', text: item.z + ' ' + zone.name }));

      var go = ML.create('span', { class: 'atl-item__go' });
      var goIcon = iconEl('arrow-right', 18);
      if (goIcon) { go.appendChild(goIcon); }
      link.appendChild(go);

      li.appendChild(link);
      frag.appendChild(li);

      rows.push({ item: item, zone: zone, el: li, link: link, hay: hay });
    });

    list.appendChild(frag);

    /* ---------- 展厅筛选 chip ---------- */
    var chipEls = [];
    if (chipsBox) {
      ZONES.forEach(function (zone) {
        var total = ITEMS.filter(function (item) { return item.z === zone.key; }).length;
        var chip = ML.create('button', { class: 'atl-chip', 'aria-pressed': 'false' });
        chip.type = 'button';
        chip.setAttribute('data-zone', zone.key);
        chip.innerHTML = '<span class="atl-chip__key">' + zone.key + '</span>' +
          '<span class="atl-chip__name">' + zone.name + '</span>' +
          '<span class="atl-chip__n tnum">' + total + '</span>' +
          '<span class="atl-chip__tick" aria-hidden="true"></span>';
        chip.setAttribute('aria-label', zone.key + ' ' + zone.name + ' · ' + total + ' 个条目');
        chipsBox.appendChild(chip);
        chipEls.push(chip);
      });
    }

    /* ---------- 状态 ---------- */
    var state = { query: [], zones: [], timer: 0 };

    function selectedZones() {
      return chipEls.filter(function (chip) {
        return chip.getAttribute('aria-pressed') === 'true';
      }).map(function (chip) {
        return chip.getAttribute('data-zone');
      });
    }

    function queryTokens() {
      return input.value.toLowerCase().split(/\s+/).filter(function (part) {
        return part.length > 0;
      });
    }

    function matches(row, tokens, zones) {
      if (zones.length && zones.indexOf(row.item.z) === -1) { return false; }
      for (var i = 0; i < tokens.length; i += 1) {
        if (row.hay.indexOf(tokens[i]) === -1) { return false; }
      }
      return true;
    }

    function visibleLinks() {
      return ML.qa('.atl-item:not([hidden]) .atl-item__link', list);
    }

    /* ---------- FLIP：只动 transform / opacity ---------- */
    function flip(firstTops) {
      var moves = [];
      var enters = [];
      rows.forEach(function (row) {
        if (row.el.hidden) { return; }
        var now = row.el.getBoundingClientRect().top;
        var before = firstTops.get(row.el);
        if (before === undefined) {
          enters.push(row.el);
        } else if (Math.abs(before - now) > 0.5) {
          moves.push({ el: row.el, dy: before - now });
        }
      });
      if (!moves.length && !enters.length) { return; }

      var duration = tokenMs('--dur-base', 240);
      var easing = tokenEase('--ease-out-quint');
      var painted = false;

      function paint() {
        if (painted) { return; }
        painted = true;
        moves.forEach(function (move) {
          try {
            move.el.animate(
              [{ transform: 'translate3d(0,' + move.dy.toFixed(2) + 'px,0)' }, { transform: 'translate3d(0,0,0)' }],
              { duration: duration, easing: easing, fill: 'none' }
            );
          } catch (err) { /* 动画不可用时结果本身仍然正确 */ }
        });
        enters.slice(0, 14).forEach(function (el, index) {
          try {
            el.animate(
              [{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
              { duration: duration, delay: index * 20, easing: easing, fill: 'both' }
            );
          } catch (err) { /* 同上 */ }
        });
      }

      /* 优先在 rAF 内写动画；若 rAF 被节流或暂停（后台标签页、无头验证），
         64ms 后同步落位一次，保证位移重排永远可见、不依赖于帧的投递。 */
      requestAnimationFrame(paint);
      window.setTimeout(paint, 64);
    }

    /* ---------- 应用筛选 ---------- */
    function applyFilter(animate) {
      var tokens = queryTokens();
      var zones = selectedZones();
      var firstTops = null;
      var visible = 0;

      if (animate && !isReduced()) {
        firstTops = new Map();
        rows.forEach(function (row) {
          if (!row.el.hidden) { firstTops.set(row.el, row.el.getBoundingClientRect().top); }
        });
      }

      rows.forEach(function (row) {
        var ok = matches(row, tokens, zones);
        if (ok) { visible += 1; }
        row.el.hidden = !ok;
      });

      state.query = tokens;
      state.zones = zones;

      if (countEl) {
        var label = visible + ' 个条目';
        if (countEl.textContent !== label) { countEl.textContent = label; }
      }
      if (activeEl) {
        var parts = [];
        parts.push(zones.length ? '展厅 ' + zones.join('、') : '全部展厅');
        if (tokens.length) { parts.push('关键词「' + tokens.join(' ') + '」'); }
        activeEl.textContent = '当前筛选：' + parts.join(' · ') + ' — 命中 ' + visible + ' 条';
      }
      if (clearInput) { clearInput.hidden = input.value.length === 0; }

      if (emptyBox) {
        if (visible === 0) {
          emptyBox.hidden = false;
          if (emptyWhy) {
            var why = [];
            why.push(zones.length ? '展厅限定为 ' + zones.join('、') : '未限定展厅');
            if (tokens.length) { why.push('关键词「' + tokens.join(' ') + '」'); }
            emptyWhy.textContent = '已应用的条件：' + why.join('，') + '。没有任何条目同时命中，建议先取消一个展厅，或删掉一个关键词。';
          }
        } else {
          emptyBox.hidden = true;
        }
      }

      resetRoving();

      if (firstTops) { flip(firstTops); }
    }

    /* ---------- 键盘漫游 ---------- */
    function clearActive() {
      rows.forEach(function (row) { row.el.classList.remove('atl-item--active'); });
    }

    function focusLink(links, index) {
      if (!links.length) { return; }
      var target = links[Math.min(links.length - 1, Math.max(0, index))];
      links.forEach(function (link, i) { link.tabIndex = i === index ? 0 : -1; });
      clearActive();
      var li = target.closest('.atl-item');
      if (li) { li.classList.add('atl-item--active'); }
      target.focus({ preventScroll: true });
      var behavior = isReduced() ? 'auto' : 'smooth';
      try {
        target.scrollIntoView({ block: 'nearest', behavior: behavior });
      } catch (err) {
        target.scrollIntoView();
      }
    }

    function resetRoving() {
      var links = visibleLinks();
      links.forEach(function (link) { link.tabIndex = -1; });
      clearActive();
      if (links.length) { links[0].tabIndex = 0; }
      if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.atl-item[hidden]')) {
        if (links.length) { links[0].focus({ preventScroll: true }); }
      }
    }

    ML.on(list, 'keydown', function (event) {
      var links = visibleLinks();
      if (!links.length) { return; }
      var current = links.indexOf(document.activeElement);
      var next = null;
      if (event.key === 'ArrowDown') { next = current < 0 ? 0 : current + 1; }
      else if (event.key === 'ArrowUp') { next = current < 0 ? 0 : current - 1; }
      else if (event.key === 'PageDown') { next = (current < 0 ? 0 : current) + 10; }
      else if (event.key === 'PageUp') { next = (current < 0 ? 0 : current) - 10; }
      if (next === null) { return; }
      event.preventDefault();
      focusLink(links, next);
    });

    /* ---------- 搜索框 ---------- */
    ML.on(input, 'input', function () {
      if (clearInput) { clearInput.hidden = input.value.length === 0; }
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(function () { applyFilter(true); }, DEBOUNCE_MS);
    });

    ML.on(input, 'keydown', function (event) {
      if (event.key === 'Escape') {
        if (input.value) {
          event.preventDefault();
          input.value = '';
          applyFilter(true);
        }
      }
      if (event.key === 'ArrowDown') {
        var links = visibleLinks();
        if (links.length) {
          event.preventDefault();
          focusLink(links, 0);
        }
      }
    });

    if (form) {
      ML.on(form, 'submit', function (event) {
        event.preventDefault();
        window.clearTimeout(state.timer);
        applyFilter(true);
        var links = visibleLinks();
        if (links.length) { focusLink(links, 0); }
      });
    }

    if (clearInput) {
      ML.on(clearInput, 'click', function () {
        input.value = '';
        input.focus();
        applyFilter(true);
      });
    }

    /* ---------- 展厅 chip ---------- */
    chipEls.forEach(function (chip) {
      ML.on(chip, 'click', function () {
        var pressed = chip.getAttribute('aria-pressed') === 'true';
        var tick = chip.querySelector('.atl-chip__tick');
        chip.setAttribute('aria-pressed', pressed ? 'false' : 'true');
        if (tick) {
          while (tick.firstChild) { tick.removeChild(tick.firstChild); }
          if (!pressed) {
            var tickIcon = iconEl('check', 16);
            if (tickIcon) { tick.appendChild(tickIcon); }
          }
        }
        applyFilter(true);
      });
    });

    function resetAll() {
      input.value = '';
      chipEls.forEach(function (chip) {
        chip.setAttribute('aria-pressed', 'false');
        var tick = chip.querySelector('.atl-chip__tick');
        if (tick) { while (tick.firstChild) { tick.removeChild(tick.firstChild); } }
      });
      applyFilter(true);
    }

    if (resetBtn) { ML.on(resetBtn, 'click', resetAll); }
    if (emptyReset) { ML.on(emptyReset, 'click', resetAll); }

    /* ---------- 快捷键：/ 聚焦本页搜索 ----------
       site.js 也把 / 绑定到命令面板（document 冒泡阶段）。本页有真实搜索框，
       按惯例由页面级搜索接管 /，因此在捕获阶段截断该按键；⌘K 仍然打开命令面板。 */
    function isTypingTarget(node) {
      if (!node || !node.tagName) { return false; }
      var tag = node.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable === true;
    }

    ML.on(document, 'keydown', function (event) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) { return; }
      if (isTypingTarget(event.target)) { return; }
      event.preventDefault();
      event.stopImmediatePropagation();
      input.focus();
      input.select();
    }, { capture: true });

    /* ---------- 回到筛选器 ---------- */
    if (topBtn) {
      var threshold = 0;
      var measure = function () {
        threshold = form.offsetTop + form.offsetHeight;
      };
      var syncTop = function () {
        var scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
        var shouldHide = scrolled < threshold;
        if (topBtn.hidden !== shouldHide) { topBtn.hidden = shouldHide; }
      };
      measure();
      syncTop();
      /* 直接监听 scroll 并在同一帧内只做一次比较：不依赖 rAF 节流，
         避免个别环境（无头验证 / 帧稀缺）下按钮永远不出现。 */
      ML.on(window, 'scroll', syncTop, { passive: true });
      ML.on(window, 'resize', function () { measure(); syncTop(); }, { passive: true });
      ML.on(topBtn, 'click', function () {
        var from = window.pageYOffset || 0;
        if (ML.scroll && typeof ML.scroll.to === 'function') {
          ML.scroll.to('#filters');
        } else {
          form.scrollIntoView({ block: 'start' });
        }
        /* 兜底：平滑滚动不可用时直接落位 */
        window.setTimeout(function () {
          var now = window.pageYOffset || 0;
          if (Math.abs(now - from) < 2 && from > 4) {
            try {
              form.scrollIntoView({ block: 'start', behavior: 'instant' });
            } catch (err) {
              window.scrollTo(0, Math.max(0, threshold - form.offsetHeight - 24));
            }
          }
        }, 340);
      });
    }

    /* ---------- 首屏 ---------- */
    if (countEl) { countEl.textContent = ITEMS.length + ' 个条目'; }
    applyFilter(false);
  }

  document.addEventListener('ml:ready', boot, { once: true });
})();
