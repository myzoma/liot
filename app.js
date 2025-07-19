class ElliottWaveRadar {
    constructor() {
        this.symbols = [];
        this.results = [];
        this.chart = null;
        this.stats = {
            total: 0,
            bullish: 0,
            bearish: 0,
            avgConfidence: 0
        };
        // إضافة تتبع أنواع الموجات
        this.waveTypes = {
            impulse: 0,
            corrective: 0,
            diagonal: 0,
            triangle: 0,
            flat: 0,
            zigzag: 0,
            complex: 0
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initChart();
        this.runRadar();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterResults(e.target.dataset.filter);
            });
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('recommendationModal').style.display = 'none';
        });
                
        // Copy recommendation
        document.getElementById('copyRecommendation').addEventListener('click', () => {
            this.copyRecommendation();
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('recommendationModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
  
 async runRadar() {
        const loadingElement = document.getElementById("loading");
        
        try {
            loadingElement.querySelector('p').textContent = "🔄 جاري جلب قائمة العملات...";
            
            this.symbols = await this.fetchTopSymbols(100);
            
            if (this.symbols.length === 0) {
                loadingElement.innerHTML = `
                    <div class="error-message">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                        <p>❌ فشل في جلب قائمة العملات</p>
                    </div>
                `;
                return;
            }
            
            loadingElement.querySelector('p').textContent = `🔄 جاري تحليل ${this.symbols.length} عملة...`;
            
            // تحليل العملات بشكل متتالي مع تأخير لتجنب حدود API
            for (let i = 0; i < this.symbols.length; i++) {
                setTimeout(() => {
                    this.analyzeSymbol(this.symbols[i]);
                    
                    // تحديث شريط التقدم
                    const progress = Math.round(((i + 1) / this.symbols.length) * 100);
                    const loadingP = loadingElement.querySelector('p');
                    if (loadingP) {
                        loadingP.textContent = 
                            `🔄 تم تحليل ${i + 1} من ${this.symbols.length} عملة (${progress}%)`;
                    }
                    
                    // إخفاء شاشة التحميل عند الانتهاء
                    if (i === this.symbols.length - 1) {
                        setTimeout(() => {
                            loadingElement.style.display = 'none';
                        }, 2000);
                    }
                }, i * 600); // تأخير 600ms بين كل طلب
            }
            
        } catch (error) {
            console.error('خطأ في تشغيل الرادار:', error);
            loadingElement.innerHTML = `
                <div class="error-message">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>❌ حدث خطأ في تشغيل الرادار</p>
                </div>
            `;
        }
    }
    initChart() {
        // تدمير المخطط السابق إذا كان موجوداً
        if (this.chart) {
            this.chart.destroy();
        }
        const ctx = document.getElementById('signalsChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['إشارات صاعدة', 'إشارات هابطة', 'محايد'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        '#00ff88',
                        '#ff4757',
                        '#ffa502'
                    ],
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20,
                            font: {
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }

    async fetchTopSymbols(limit = 100) {
        try {
            const res = await fetch('https://api1.binance.com/api/v3/ticker/24hr');
            const data = await res.json();
            return data
                .filter(d => d.symbol.endsWith('USDT') &&
                            !d.symbol.includes('UP') &&
                            !d.symbol.includes('DOWN'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, limit)
                .map(d => d.symbol);
        } catch (error) {
            console.error('خطأ في جلب العملات:', error);
            return [];
        }
    }

    async fetchKlines(symbol, interval = '1h', limit = 120) {
        try {
            const url = `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const res = await fetch(url);
            const data = await res.json();
            return data.map(k => [k[0], k[1], k[2], k[3], k[4], k[5]]);
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol}:`, error);
            return null;
        }
    }

    async analyzeSymbol(symbol) {
        try {
            const data = await this.fetchKlines(symbol);
            if (!data) return;

            // استخدام محللك الموجود مع تحسينات
            const analyzer = new ElliottWaveAnalyzer();
            const result = analyzer.analyze(data);
                        
            if (result.status === 'success' && result.patterns.length > 0) {
                const pattern = result.patterns[0];
                if (pattern.confidence >= 75) {
                    // تحليل شامل لجميع أنواع الموجات
                    const completeWaveAnalysis = this.performCompleteWaveAnalysis(data, pattern, result);
                    
                    const analysisResult = {
                        symbol,
                        pattern,
                        trend: result.trend,
                        wave: result.currentWaveAnalysis,
                        completeWaveAnalysis, // إضافة التحليل الشامل
                        targets: this.calculateTargets(data, pattern),
                        recommendation: this.generateRecommendation(pattern, result.trend, data, completeWaveAnalysis)
                    };
                                    
                    this.results.push(analysisResult);
                    this.updateWaveTypeStats(completeWaveAnalysis);
                    this.updateStats();
                    this.renderCard(analysisResult);
                }
            }
        } catch (error) {
            console.warn(`❌ خطأ في تحليل ${symbol}:`, error.message);
        }
    }
renderCard(result) {
    const container = document.getElementById("results");
    if (!container) return; // تحقق من وجود العنصر

    const { symbol, pattern, trend, wave, targets, recommendation } = result;

    // تحقق من وجود بيانات الأهداف
    if (!targets || !targets.target1 || !targets.target2 || !targets.target3 || !targets.stopLoss) {
        console.warn('بيانات الأهداف ناقصة لهذه العملة:', symbol, targets);
        return;
    }

    const trendIcon = pattern.direction === 'bullish' ? 'fa-arrow-up text-success' : 'fa-arrow-down text-danger';
    const waveText = wave?.currentWave ? wave.currentWave : 'غير محددة';
    const confidenceClass = pattern.confidence >= 85 ? 'text-success' : pattern.confidence >= 75 ? 'text-warning' : 'text-danger';

    const card = document.createElement("div");
    card.className = "card fade-in";
    card.dataset.direction = pattern.direction;
    card.dataset.confidence = pattern.confidence >= 85 ? 'high' : 'normal';

    card.innerHTML = `
        <h2><i class="fa-solid fa-coins"></i> ${symbol}</h2>
        <p><i class="fa-solid fa-chart-line"></i> النمط: ${pattern.type} 
           <span class="${pattern.direction === 'bullish' ? 'text-success' : 'text-danger'}">
               ${pattern.direction === 'bullish' ? '🚀 صاعد' : '📉 هابط'}
           </span>
        </p>
        <p><i class="fa-solid fa-shield-halved"></i> الثقة: 
           <span class="confidence ${confidenceClass}">${pattern.confidence}%</span>
        </p>
        <p><i class="fa-solid fa-location-crosshairs"></i> الموجة الحالية: ${waveText}</p>
        <p><i class="fa-solid ${trendIcon}"></i> الاتجاه العام: ${trend}</p>
        <div class="price-targets">
            <h4><i class="fa-solid fa-bullseye"></i> الأهداف السعرية</h4>
            <p>🎯 الهدف الأول: $${targets.target1.toFixed(4)}</p>
            <p>🎯 الهدف الثاني: $${targets.target2.toFixed(4)}</p>
            <p>🎯 الهدف الثالث: $${targets.target3.toFixed(4)}</p>
            <p>🛑 وقف الخسارة: $${targets.stopLoss.toFixed(4)}</p>
        </div>
        <button class="recommendation-btn" onclick="window.radar.showRecommendation('${symbol}')">
            <i class="fa-solid fa-lightbulb"></i>
            عرض التوصية الكاملة
        </button>
    `;

    container.appendChild(card);
}
    // دالة جديدة للتحليل الشامل لجميع أنواع الموجات
    performCompleteWaveAnalysis(data, pattern, result) {
        const prices = data.map(d => parseFloat(d[4]));
        const highs = data.map(d => parseFloat(d[2]));
        const lows = data.map(d => parseFloat(d[3]));
        
        return {
            // تحليل الموجات الدافعة (Impulse Waves)
            impulseWaves: this.analyzeImpulseWaves(prices, highs, lows),
            
            // تحليل الموجات التصحيحية (Corrective Waves)
            correctiveWaves: this.analyzeCorrectiveWaves(prices, highs, lows),
            
            // تحليل الموجات القطرية (Diagonal Waves)
            diagonalWaves: this.analyzeDiagonalWaves(prices, highs, lows),
            
            // تحليل أنماط المثلث (Triangle Patterns)
            trianglePatterns: this.analyzeTrianglePatterns(prices, highs, lows),
            
            // تحليل الأنماط المسطحة (Flat Patterns)
            flatPatterns: this.analyzeFlatPatterns(prices, highs, lows),
            
            // تحليل الأنماط المتعرجة (Zigzag Patterns)
            zigzagPatterns: this.analyzeZigzagPatterns(prices, highs, lows),
            
            // تحليل الأنماط المعقدة (Complex Patterns)
            complexPatterns: this.analyzeComplexPatterns(prices, highs, lows),
            
            // تحليل دورة الموجة الكاملة
            waveCount: this.getWaveCount(result.currentWaveAnalysis),
            
            // تحديد نوع الموجة الرئيسي
            primaryWaveType: this.determinePrimaryWaveType(pattern, result),
            
            // تحليل قوة الموجة
            waveStrength: this.calculateWaveStrength(prices, pattern),
            
            // تحليل مستويات فيبوناتشي للموجات
            fibonacciLevels: this.calculateWaveFibonacci(prices, highs, lows),
            
            // تحليل الزمن للموجات
            timeAnalysis: this.analyzeWaveTime(data),
            
            // تحليل الحجم للموجات
            volumeAnalysis: this.analyzeWaveVolume(data)
        };
    }

    // تحليل الموجات الدافعة
    analyzeImpulseWaves(prices, highs, lows) {
        const waves = [];
        let currentWave = 1;
        
        for (let i = 5; i < prices.length - 5; i++) {
            const segment = prices.slice(i-5, i+5);
            const isImpulse = this.detectImpulsePattern(segment);
            
            if (isImpulse.detected) {
                waves.push({
                    type: 'impulse',
                    wave: `wave_${currentWave}`,
                    startIndex: i-5,
                    endIndex: i+5,
                    strength: isImpulse.strength,
                    direction: isImpulse.direction,
                    characteristics: this.getImpulseCharacteristics(currentWave)
                });
                currentWave = currentWave === 5 ? 1 : currentWave + 1;
            }
        }
        
        return waves;
    }

    // تحليل الموجات التصحيحية
    analyzeCorrectiveWaves(prices, highs, lows) {
        const waves = [];
        const correctiveTypes = ['a', 'b', 'c'];
        let currentWave = 0;
        
        for (let i = 8; i < prices.length - 8; i++) {
            const segment = prices.slice(i-8, i+8);
            const isCorrectivePattern = this.detectCorrectivePattern(segment);
            
            if (isCorrectivePattern.detected) {
                waves.push({
                    type: 'corrective',
                    wave: `wave_${correctiveTypes[currentWave]}`,
                    startIndex: i-8,
                    endIndex: i+8,
                    pattern: isCorrectivePattern.pattern,
                    retracement: isCorrectivePattern.retracement,
                    characteristics: this.getCorrectiveCharacteristics(correctiveTypes[currentWave])
                });
                currentWave = (currentWave + 1) % 3;
            }
        }
        
        return waves;
    }

    // تحليل الموجات القطرية
    analyzeDiagonalWaves(prices, highs, lows) {
        const diagonals = [];
        
        for (let i = 10; i < prices.length - 10; i++) {
            const segment = prices.slice(i-10, i+10);
            const isDiagonal = this.detectDiagonalPattern(segment);
            
            if (isDiagonal.detected) {
                diagonals.push({
                    type: 'diagonal',
                    subtype: isDiagonal.subtype, // leading or ending
                    startIndex: i-10,
                    endIndex: i+10,
                    angle: isDiagonal.angle,
                    convergence: isDiagonal.convergence,
                    characteristics: this.getDiagonalCharacteristics(isDiagonal.subtype)
                });
            }
        }
        
        return diagonals;
    }

    // تحليل أنماط المثلث
    analyzeTrianglePatterns(prices, highs, lows) {
        const triangles = [];
        const triangleTypes = ['contracting', 'expanding', 'running'];
        
        for (let i = 15; i < prices.length - 15; i++) {
            const segment = prices.slice(i-15, i+15);
            const isTriangle = this.detectTrianglePattern(segment, highs.slice(i-15, i+15), lows.slice(i-15, i+15));
            
            if (isTriangle.detected) {
                triangles.push({
                    type: 'triangle',
                    subtype: isTriangle.subtype,
                    startIndex: i-15,
                    endIndex: i+15,
                    waves: isTriangle.waves, // A, B, C, D, E
                    breakoutDirection: isTriangle.breakoutDirection,
                    characteristics: this.getTriangleCharacteristics(isTriangle.subtype)
                });
            }
        }
        
        return triangles;
    }

    // تحليل الأنماط المسطحة
    analyzeFlatPatterns(prices, highs, lows) {
        const flats = [];
        const flatTypes = ['regular', 'expanded', 'running'];
        
        for (let i = 12; i < prices.length - 12; i++) {
            const segment = prices.slice(i-12, i+12);
            const isFlat = this.detectFlatPattern(segment);
            
            if (isFlat.detected) {
                flats.push({
                    type: 'flat',
                    subtype: isFlat.subtype,
                    startIndex: i-12,
                    endIndex: i+12,
                    waves: { a: isFlat.waveA, b: isFlat.waveB, c: isFlat.waveC },
                    retracement: isFlat.retracement,
                    characteristics: this.getFlatCharacteristics(isFlat.subtype)
                });
            }
        }
        
        return flats;
    }

    // تحليل الأنماط المتعرجة
    analyzeZigzagPatterns(prices, highs, lows) {
        const zigzags = [];
        
        for (let i = 9; i < prices.length - 9; i++) {
            const segment = prices.slice(i-9, i+9);
            const isZigzag = this.detectZigzagPattern(segment);
            
            if (isZigzag.detected) {
                zigzags.push({
                    type: 'zigzag',
                    subtype: isZigzag.subtype, // regular, truncated, elongated
                    startIndex: i-9,
                    endIndex: i+9,
                    waves: { a: isZigzag.waveA, b: isZigzag.waveB, c: isZigzag.waveC },
                    sharpness: isZigzag.sharpness,
                    characteristics: this.getZigzagCharacteristics(isZigzag.subtype)
                });
            }
        }
        
        return zigzags;
    }

     // تحليل الأنماط المعقدة
    analyzeComplexPatterns(prices, highs, lows) {
        const complexPatterns = [];
        
        for (let i = 20; i < prices.length - 20; i++) {
            const segment = prices.slice(i-20, i+20);
            const isComplex = this.detectComplexPattern(segment, highs.slice(i-20, i+20), lows.slice(i-20, i+20));
            
            if (isComplex.detected) {
                complexPatterns.push({
                    type: 'complex',
                    subtype: isComplex.subtype, // double_three, triple_three, wxy, wxyz
                    startIndex: i-20,
                    endIndex: i+20,
                    components: isComplex.components,
                    linkingWaves: isComplex.linkingWaves, // X waves
                    duration: isComplex.duration,
                    characteristics: this.getComplexCharacteristics(isComplex.subtype)
                });
            }
        }
        
        return complexPatterns;
    }

    // دوال الكشف عن الأنماط
    detectImpulsePattern(segment) {
        if (segment.length < 10) return { detected: false };
        
        const peaks = this.findPeaks(segment);
        const troughs = this.findTroughs(segment);
        
        // قواعد الموجة الدافعة: 5 موجات، الموجة 3 ليست الأقصر، الموجة 2 لا تتجاوز بداية الموجة 1
        if (peaks.length >= 3 && troughs.length >= 2) {
            const wave3Length = Math.abs(segment[peaks[1]] - segment[troughs[0]]);
            const wave1Length = Math.abs(segment[peaks[0]] - segment[0]);
            const wave5Length = Math.abs(segment[segment.length-1] - segment[troughs[1]]);
            
            const isWave3Longest = wave3Length > wave1Length && wave3Length > wave5Length;
            const strength = isWave3Longest ? 85 : 70;
            
            return {
                detected: true,
                strength,
                direction: segment[segment.length-1] > segment[0] ? 'bullish' : 'bearish'
            };
        }
        
        return { detected: false };
    }

    detectCorrectivePattern(segment) {
        if (segment.length < 16) return { detected: false };
        
        const start = segment[0];
        const end = segment[segment.length-1];
        const peaks = this.findPeaks(segment);
        const troughs = this.findTroughs(segment);
        
        // نمط ABC تصحيحي
        if (peaks.length >= 1 && troughs.length >= 1) {
            const retracement = Math.abs((end - start) / start) * 100;
            
            let pattern = 'abc';
            if (retracement > 61.8) pattern = 'deep_correction';
            else if (retracement < 38.2) pattern = 'shallow_correction';
            
            return {
                detected: true,
                pattern,
                retracement: retracement.toFixed(1)
            };
        }
        
        return { detected: false };
    }

    detectDiagonalPattern(segment) {
        if (segment.length < 20) return { detected: false };
        
        const highs = [];
        const lows = [];
        
        // العثور على القمم والقيعان
        for (let i = 2; i < segment.length - 2; i++) {
            if (segment[i] > segment[i-1] && segment[i] > segment[i+1] && 
                segment[i] > segment[i-2] && segment[i] > segment[i+2]) {
                highs.push({ index: i, value: segment[i] });
            }
            if (segment[i] < segment[i-1] && segment[i] < segment[i+1] && 
                segment[i] < segment[i-2] && segment[i] < segment[i+2]) {
                lows.push({ index: i, value: segment[i] });
            }
        }
        
        if (highs.length >= 2 && lows.length >= 2) {
            // حساب زاوية التقارب
            const highSlope = (highs[highs.length-1].value - highs[0].value) / (highs[highs.length-1].index - highs[0].index);
            const lowSlope = (lows[lows.length-1].value - lows[0].value) / (lows[lows.length-1].index - lows[0].index);
            
            const convergence = Math.abs(highSlope - lowSlope);
            const angle = Math.atan(convergence) * (180 / Math.PI);
            
            if (angle > 10 && angle < 45) {
                return {
                    detected: true,
                    subtype: segment[0] < segment[segment.length-1] ? 'leading' : 'ending',
                    angle: angle.toFixed(1),
                    convergence: convergence.toFixed(4)
                };
            }
        }
        
        return { detected: false };
    }

    detectTrianglePattern(segment, highs, lows) {
        if (segment.length < 30) return { detected: false };
        
        const peaks = this.findPeaks(segment);
        const troughs = this.findTroughs(segment);
        
        if (peaks.length >= 3 && troughs.length >= 2) {
            // تحليل نمط المثلث - 5 موجات (A, B, C, D, E)
            const range1 = highs[Math.floor(highs.length * 0.2)] - lows[Math.floor(lows.length * 0.2)];
            const range2 = highs[Math.floor(highs.length * 0.8)] - lows[Math.floor(lows.length * 0.8)];
            
            let subtype = 'contracting';
            if (range2 > range1) subtype = 'expanding';
            
            // تحديد اتجاه الكسر المحتمل
            const recentTrend = segment[segment.length-1] - segment[segment.length-5];
            const breakoutDirection = recentTrend > 0 ? 'upward' : 'downward';
            
            return {
                detected: true,
                subtype,
                waves: ['A', 'B', 'C', 'D', 'E'],
                breakoutDirection
            };
        }
        
        return { detected: false };
    }

    detectFlatPattern(segment) {
        if (segment.length < 24) return { detected: false };
        
        const third = Math.floor(segment.length / 3);
        const waveA = segment.slice(0, third);
        const waveB = segment.slice(third, third * 2);
        const waveC = segment.slice(third * 2);
        
        const aRange = Math.max(...waveA) - Math.min(...waveA);
        const bRange = Math.max(...waveB) - Math.min(...waveB);
        const cRange = Math.max(...waveC) - Math.min(...waveC);
        
        // نمط مسطح: الموجة B تصل إلى 90% أو أكثر من الموجة A
        const bRetracement = (bRange / aRange) * 100;
        
        if (bRetracement >= 90) {
            let subtype = 'regular';
            if (bRetracement > 105) subtype = 'expanded';
            else if (cRange < aRange * 0.9) subtype = 'running';
            
            return {
                detected: true,
                subtype,
                waveA: { range: aRange, direction: waveA[waveA.length-1] > waveA[0] ? 'up' : 'down' },
                waveB: { range: bRange, direction: waveB[waveB.length-1] > waveB[0] ? 'up' : 'down' },
                waveC: { range: cRange, direction: waveC[waveC.length-1] > waveC[0] ? 'up' : 'down' },
                retracement: bRetracement.toFixed(1)
            };
        }
        
        return { detected: false };
    }

    detectZigzagPattern(segment) {
        if (segment.length < 18) return { detected: false };
        
        const third = Math.floor(segment.length / 3);
        const waveA = segment.slice(0, third);
        const waveB = segment.slice(third, third * 2);
        const waveC = segment.slice(third * 2);
        
        const aMove = Math.abs(waveA[waveA.length-1] - waveA[0]);
        const bMove = Math.abs(waveB[waveB.length-1] - waveB[0]);
        const cMove = Math.abs(waveC[waveC.length-1] - waveC[0]);
        
        // نمط متعرج: الموجة B أقل من 78.6% من الموجة A
        const bRetracement = (bMove / aMove) * 100;
        
        if (bRetracement < 78.6) {
            let subtype = 'regular';
            if (cMove < aMove * 0.9) subtype = 'truncated';
            else if (cMove > aMove * 1.618) subtype = 'elongated';
            
            const sharpness = 100 - bRetracement; // كلما قل الارتداد، زادت الحدة
            
            return {
                detected: true,
                subtype,
                waveA: { move: aMove, direction: waveA[waveA.length-1] > waveA[0] ? 'up' : 'down' },
                waveB: { move: bMove, direction: waveB[waveB.length-1] > waveB[0] ? 'up' : 'down' },
                waveC: { move: cMove, direction: waveC[waveC.length-1] > waveC[0] ? 'up' : 'down' },
                sharpness: sharpness.toFixed(1)
            };
        }
        
        return { detected: false };
    }

    detectComplexPattern(segment, highs, lows) {
        if (segment.length < 40) return { detected: false };
        
        // البحث عن أنماط معقدة مثل Double Three أو Triple Three
        const quarters = Math.floor(segment.length / 4);
        const components = [];
        
        for (let i = 0; i < 4; i++) {
            const component = segment.slice(i * quarters, (i + 1) * quarters);
            const componentAnalysis = this.analyzeComponent(component);
            components.push(componentAnalysis);
        }
        
        // البحث عن موجات الربط (X waves)
        const linkingWaves = this.findLinkingWaves(segment);
        
        if (components.length >= 3 && linkingWaves.length >= 1) {
            let subtype = 'double_three';
            if (components.length >= 4) subtype = 'triple_three';
            
            return {
                detected: true,
                subtype,
                components,
                linkingWaves,
                duration: segment.length
            };
        }
        
        return { detected: false };
    }

    // دوال مساعدة للتحليل
    findPeaks(data) {
        const peaks = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] > data[i-1] && data[i] > data[i+1] && 
                data[i] > data[i-2] && data[i] > data[i+2]) {
                peaks.push(i);
            }
        }
        return peaks;
    }

    findTroughs(data) {
        const troughs = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] < data[i-1] && data[i] < data[i+1] && 
                data[i] < data[i-2] && data[i] < data[i+2]) {
                troughs.push(i);
            }
        }
        return troughs;
    }

    analyzeComponent(component) {
        const start = component[0];
        const end = component[component.length - 1];
        const high = Math.max(...component);
        const low = Math.min(...component);
        
        return {
            type: this.determineComponentType(component),
            direction: end > start ? 'bullish' : 'bearish',
            range: high - low,
            duration: component.length
        };
    }

    determineComponentType(component) {
        const peaks = this.findPeaks(component);
        const troughs = this.findTroughs(component);
        
        if (peaks.length >= 3 && troughs.length >= 2) return 'impulse';
        if (peaks.length <= 2 && troughs.length <= 2) return 'corrective';
        return 'complex';
    }

    findLinkingWaves(segment) {
        const linkingWaves = [];
        // البحث عن موجات X (موجات الربط)
        // هذه موجات تربط بين الأنماط التصحيحية المختلفة
        
        for (let i = 10; i < segment.length - 10; i += 10) {
            const subsegment = segment.slice(i, i + 10);
            if (this.isLinkingWave(subsegment)) {
                linkingWaves.push({
                    startIndex: i,
                    endIndex: i + 10,
                    type: 'X',
                    characteristics: 'linking_wave'
                });
            }
        }
        
        return linkingWaves;
    }

    isLinkingWave(segment) {
        // موجة الربط عادة ما تكون حركة جانبية أو تصحيحية صغيرة
        const range = Math.max(...segment) - Math.min(...segment);
        const avgRange = segment.reduce((a, b) => a + b, 0) / segment.length;
        
        return range < avgRange * 0.5; // حركة محدودة نسبياً
    }

    // دوال الحصول على خصائص الموجات
      getImpulseCharacteristics(waveNumber) {
        const characteristics = {
            1: 'بداية الاتجاه الجديد - قوة متوسطة',
            2: 'تصحيح حاد - لا يتجاوز بداية الموجة 1',
            3: 'أقوى الموجات - حجم تداول عالي - ليست الأقصر',
            4: 'تصحيح معقد - لا يتداخل مع الموجة 1',
            5: 'موجة نهائية - قد تظهر تباعد في المؤشرات'
        };
        
        return characteristics[waveNumber] || 'خصائص غير محددة';
    }

    getCorrectiveCharacteristics(pattern) {
        const characteristics = {
            'zigzag': 'حركة حادة 5-3-5 - تصحيح عميق',
            'flat': 'حركة جانبية 3-3-5 - تصحيح أفقي',
            'triangle': 'تقلبات متناقصة 3-3-3-3-3 - توطيد',
            'double_three': 'تصحيح معقد W-X-Y',
            'triple_three': 'تصحيح معقد جداً W-X-Y-X-Z'
        };
        
        return characteristics[pattern] || 'نمط تصحيحي معقد';
    }

    getDiagonalCharacteristics(type) {
        const characteristics = {
            'leading': 'مثلث قائد - بداية موجة دافعة جديدة',
            'ending': 'مثلث نهائي - نهاية الاتجاه الحالي'
        };
        
        return characteristics[type] || 'نمط قطري';
    }

    getTriangleCharacteristics(subtype) {
        const characteristics = {
            'contracting': 'مثلث متقلص - تقلبات متناقصة',
            'expanding': 'مثلث متوسع - تقلبات متزايدة',
            'ascending': 'مثلث صاعد - مقاومة أفقية',
            'descending': 'مثلث هابط - دعم أفقي',
            'symmetrical': 'مثلث متماثل - تقارب متوازن'
        };
        
        return characteristics[subtype] || 'نمط مثلثي';
    }

    getFlatCharacteristics(subtype) {
        const characteristics = {
            'regular': 'مسطح عادي - B = 90% من A',
            'expanded': 'مسطح موسع - B > 105% من A',
            'running': 'مسطح جاري - C < A'
        };
        
        return characteristics[subtype] || 'نمط مسطح';
    }

    getZigzagCharacteristics(subtype) {
        const characteristics = {
            'regular': 'متعرج عادي - C = A تقريباً',
            'truncated': 'متعرج مقطوع - C < A',
            'elongated': 'متعرج ممدود - C > 1.618 × A'
        };
        
        return characteristics[subtype] || 'نمط متعرج';
    }

    getComplexCharacteristics(subtype) {
        const characteristics = {
            'double_three': 'نمط W-X-Y - تصحيح مزدوج',
            'triple_three': 'نمط W-X-Y-X-Z - تصحيح ثلاثي',
            'wxy': 'تسلسل تصحيحي معقد',
            'wxyz': 'تسلسل تصحيحي معقد جداً'
        };
        
        return characteristics[subtype] || 'نمط معقد';
    }

    // حساب مستويات فيبوناتشي المتقدمة
    calculateAdvancedFibonacci(startPrice, endPrice, waveType = 'impulse') {
        const difference = endPrice - startPrice;
        const fibLevels = {};
        
        if (waveType === 'impulse') {
            // مستويات فيبوناتشي للموجات الدافعة
            fibLevels.retracements = {
                '23.6%': endPrice - (difference * 0.236),
                '38.2%': endPrice - (difference * 0.382),
                '50.0%': endPrice - (difference * 0.5),
                '61.8%': endPrice - (difference * 0.618),
                '78.6%': endPrice - (difference * 0.786)
            };
            
            fibLevels.extensions = {
                '127.2%': endPrice + (difference * 0.272),
                '161.8%': endPrice + (difference * 0.618),
                '200.0%': endPrice + (difference * 1.0),
                '261.8%': endPrice + (difference * 1.618),
                '423.6%': endPrice + (difference * 3.236)
            };
        } else {
            // مستويات فيبوناتشي للموجات التصحيحية
            fibLevels.corrections = {
                '38.2%': startPrice + (difference * 0.382),
                '50.0%': startPrice + (difference * 0.5),
                '61.8%': startPrice + (difference * 0.618),
                '78.6%': startPrice + (difference * 0.786),
                '88.6%': startPrice + (difference * 0.886)
            };
        }
        
        return fibLevels;
    }

    // تحليل العلاقات الزمنية
    analyzeTimeRelationships(waves) {
        const timeRelationships = [];
        
        for (let i = 1; i < waves.length; i++) {
            const currentWave = waves[i];
            const previousWave = waves[i-1];
            
            const timeRatio = currentWave.duration / previousWave.duration;
            let relationship = 'غير محدد';
            
            if (Math.abs(timeRatio - 1) < 0.1) relationship = 'تساوي زمني (1:1)';
            else if (Math.abs(timeRatio - 0.618) < 0.1) relationship = 'نسبة ذهبية (0.618:1)';
            else if (Math.abs(timeRatio - 1.618) < 0.1) relationship = 'نسبة ذهبية (1.618:1)';
            else if (Math.abs(timeRatio - 2) < 0.1) relationship = 'ضعف الزمن (2:1)';
            else if (Math.abs(timeRatio - 0.5) < 0.1) relationship = 'نصف الزمن (0.5:1)';
            
            timeRelationships.push({
                wave1: i-1,
                wave2: i,
                ratio: timeRatio.toFixed(3),
                relationship,
                significance: this.getTimeSignificance(relationship)
            });
        }
        
        return timeRelationships;
    }

    getTimeSignificance(relationship) {
        const significance = {
            'تساوي زمني (1:1)': 'عالية - تناسق زمني مثالي',
            'نسبة ذهبية (0.618:1)': 'عالية جداً - نسبة فيبوناتشي',
            'نسبة ذهبية (1.618:1)': 'عالية جداً - نسبة فيبوناتشي',
            'ضعف الزمن (2:1)': 'متوسطة - تناسق رقمي',
            'نصف الزمن (0.5:1)': 'متوسطة - تناسق رقمي'
        };
        
        return significance[relationship] || 'منخفضة';
    }

    // تحليل قوة الموجات
    analyzeWaveStrength(priceData, volumeData, wave) {
        const waveSegment = priceData.slice(wave.startIndex, wave.endIndex);
        const waveVolume = volumeData ? volumeData.slice(wave.startIndex, wave.endIndex) : null;
        
        let strength = 0;
        const factors = [];
        
        // عامل المدى السعري
        const priceRange = Math.max(...waveSegment) - Math.min(...waveSegment);
        const avgRange = this.calculateAverageRange(priceData);
        const rangeRatio = priceRange / avgRange;
        
        if (rangeRatio > 1.5) {
            strength += 25;
            factors.push('مدى سعري واسع');
        } else if (rangeRatio < 0.5) {
            strength -= 15;
            factors.push('مدى سعري ضيق');
        }
        
        // عامل الحجم (إذا كان متاحاً)
        if (waveVolume) {
            const avgVolume = waveVolume.reduce((a, b) => a + b, 0) / waveVolume.length;
            const totalAvgVolume = volumeData.reduce((a, b) => a + b, 0) / volumeData.length;
            const volumeRatio = avgVolume / totalAvgVolume;
            
            if (volumeRatio > 1.3) {
                strength += 20;
                factors.push('حجم تداول عالي');
            } else if (volumeRatio < 0.7) {
                strength -= 10;
                factors.push('حجم تداول منخفض');
            }
        }
        
        // عامل السرعة
        const duration = wave.endIndex - wave.startIndex;
        if (duration < 10) {
            strength += 15;
            factors.push('حركة سريعة');
        } else if (duration > 50) {
            strength -= 5;
            factors.push('حركة بطيئة');
        }
        
        // عامل الاتجاه
        const trend = this.calculateTrend(waveSegment);
        if (Math.abs(trend) > 0.8) {
            strength += 20;
            factors.push('اتجاه واضح');
        }
        
        return {
            strength: Math.max(0, Math.min(100, strength + 50)), // تطبيع النتيجة بين 0-100
            factors,
            details: {
                priceRange: priceRange.toFixed(2),
                rangeRatio: rangeRatio.toFixed(2),
                duration,
                trend: trend.toFixed(3)
            }
        };
    }

    calculateAverageRange(data) {
        let totalRange = 0;
        const windowSize = 20;
        
        for (let i = windowSize; i < data.length; i++) {
            const segment = data.slice(i - windowSize, i);
            const range = Math.max(...segment) - Math.min(...segment);
            totalRange += range;
        }
        
        return totalRange / (data.length - windowSize);
    }

    calculateTrend(data) {
        // حساب معامل الارتباط الخطي
        const n = data.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = data;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const correlation = (n * sumXY - sumX * sumY) / 
                          Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY.reduce((sum, yi) => sum + yi * yi, 0) - sumY * sumY));
        
        return correlation || 0;
    }

    // تحديد نقاط الدخول والخروج
    identifyTradingOpportunities(analysis, currentPrice) {
        const opportunities = [];
        
        analysis.patterns.forEach(pattern => {
            if (pattern.type === 'impulse' && pattern.confidence > 70) {
                // فرصة تداول على الموجة الدافعة
                const opportunity = this.createImpulseOpportunity(pattern, currentPrice);
                if (opportunity) opportunities.push(opportunity);
            }
            
            if (pattern.type === 'corrective' && pattern.confidence > 65) {
                // فرصة تداول على النمط التصحيحي
                const opportunity = this.createCorrectiveOpportunity(pattern, currentPrice);
                if (opportunity) opportunities.push(opportunity);
            }
            
            if (pattern.type === 'triangle' && pattern.confidence > 60) {
                // فرصة كسر المثلث
                const opportunity = this.createTriangleBreakoutOpportunity(pattern, currentPrice);
                if (opportunity) opportunities.push(opportunity);
            }
        });
        
        return opportunities.sort((a, b) => b.confidence - a.confidence);
    }

    createImpulseOpportunity(pattern, currentPrice) {
        const fibLevels = this.calculateAdvancedFibonacci(
            pattern.startPrice, 
            pattern.endPrice, 
            'impulse'
        );
        
        let entry, stopLoss, takeProfit, direction;
        
        if (pattern.direction === 'bullish') {
            direction = 'شراء';
            entry = fibLevels.retracements['38.2%'];
            stopLoss = fibLevels.retracements['61.8%'];
            takeProfit = fibLevels.extensions['161.8%'];
        } else {
            direction = 'بيع';
            entry = fibLevels.retracements['38.2%'];
            stopLoss = fibLevels.retracements['61.8%'];
            takeProfit = fibLevels.extensions['161.8%'];
        }
        
        // التحقق من صحة الفرصة
        if (Math.abs(currentPrice - entry) / currentPrice > 0.1) {
            return null; // الفرصة بعيدة جداً
        }
        
        return {
            type: 'impulse_continuation',
            direction,
            entry: entry.toFixed(2),
            stopLoss: stopLoss.toFixed(2),
            takeProfit: takeProfit.toFixed(2),
            riskReward: (Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss)).toFixed(2),
            confidence: pattern.confidence,
            timeframe: pattern.timeframe || 'متوسط المدى',
            description: `فرصة ${direction} على استكمال الموجة الدافعة`,
            waveContext: pattern.currentWave || 'غير محدد'
        };
    }

    createCorrectiveOpportunity(pattern, currentPrice) {
        const fibLevels = this.calculateAdvancedFibonacci(
            pattern.startPrice, 
            pattern.endPrice, 
            'corrective'
        );
        
        let entry, stopLoss, takeProfit, direction;
        
        if (pattern.subtype === 'zigzag') {
            // انتظار انتهاء التصحيح المتعرج
            direction = pattern.direction === 'bearish' ? 'شراء' : 'بيع';
            entry = fibLevels.corrections['61.8%'];
            stopLoss = fibLevels.corrections['78.6%'];
            takeProfit = pattern.startPrice;
        } else if (pattern.subtype === 'flat') {
            // تداول على النمط المسطح
            direction = 'شراء/بيع حسب الكسر';
            entry = currentPrice;
            stopLoss = pattern.direction === 'bearish' ? pattern.endPrice * 1.02 : pattern.endPrice * 0.98;
            takeProfit = pattern.startPrice;
        }
        
        return {
            type: 'corrective_completion',
            direction,
            entry: entry.toFixed(2),
            stopLoss: stopLoss.toFixed(2),
            takeProfit: takeProfit.toFixed(2),
            riskReward: (Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss)).toFixed(2),
            confidence: pattern.confidence,
            timeframe: 'قصير إلى متوسط المدى',
            description: `فرصة تداول على انتهاء النمط التصحيحي ${pattern.subtype}`,
            correctionLevel: pattern.retracement || 'غير محدد'
        };
    }

    createTriangleBreakoutOpportunity(pattern, currentPrice) {
        const range = Math.abs(pattern.upperBound - pattern.lowerBound);
        const breakoutTarget = range * 0.618; // هدف الكسر المتوقع
        
        return {
            type: 'triangle_breakout',
            direction: pattern.breakoutDirection === 'upward' ? 'شراء' : 'بيع',
            entry: pattern.breakoutDirection === 'upward' ? 
                   (pattern.upperBound + range * 0.01).toFixed(2) : 
                   (pattern.lowerBound - range * 0.01).toFixed(2),
            stopLoss: pattern.breakoutDirection === 'upward' ? 
                     (pattern.lowerBound).toFixed(2) : 
                     (pattern.upperBound).toFixed(2),
            takeProfit: pattern.breakoutDirection === 'upward' ? 
                       (pattern.upperBound + breakoutTarget).toFixed(2) : 
                       (pattern.lowerBound - breakoutTarget).toFixed(2),
            riskReward: (breakoutTarget / range).toFixed(2),
            confidence: pattern.confidence,
            timeframe: 'قصير المدى',
            description: `فرصة كسر المثلث ${pattern.subtype}`,
            triangleType: pattern.subtype
        };
    }

    // تحليل السيناريوهات المحتملة
    generateScenarios(analysis, currentPrice) {
        const scenarios = [];
        
        // السيناريو الصاعد
        const bullishScenario = this.createBullishScenario(analysis, currentPrice);
        if (bullishScenario) scenarios.push(bullishScenario);
        
        // السيناريو الهابط
        const bearishScenario = this.createBearishScenario(analysis, currentPrice);
        if (bearishScenario) scenarios.push(bearishScenario);
        
        // السيناريو الجانبي
        const sidewaysScenario = this.createSidewaysScenario(analysis, currentPrice);
        if (sidewaysScenario) scenarios.push(sidewaysScenario);
        
        return scenarios;
    }

    createBullishScenario(analysis, currentPrice) {
        const bullishPatterns = analysis.patterns.filter(p => 
            p.direction === 'bullish' || p.type === 'impulse'
        );
        
        if (bullishPatterns.length === 0) return null;
        
        const strongestPattern = bullishPatterns.reduce((prev, current) => 
            (prev.confidence > current.confidence) ? prev : current
        );
        
        const targets = this.calculateBullishTargets(strongestPattern, currentPrice);
        
        return {
            direction: 'صاعد',
            probability: this.calculateScenarioProbability(bullishPatterns, analysis),
            keyLevels: targets,
            timeframe: '1-4 أسابيع',
            triggers: [
                `كسر مستوى ${targets.resistance}`,
                'زيادة في حجم التداول',
                'تأكيد الموجة الدافعة'
            ],
            invalidation: `إغلاق تحت ${targets.support}`,
            description: 'استكمال النمط الصاعد مع أهداف فيبوناتشي'
        };
    }

    createBearishScenario(analysis, currentPrice) {
        const bearishPatterns = analysis.patterns.filter(p => 
            p.direction === 'bearish' || (p.type === 'corrective' && p.subtype === 'zigzag')
        );
        
        if (bearishPatterns.length === 0) return null;
        
        const strongestPattern = bearishPatterns.reduce((prev, current) => 
            (prev.confidence > current.confidence) ? prev : current
        );
        
        const targets = this.calculateBearishTargets(strongestPattern, currentPrice);
        
        return {
            direction: 'هابط',
            probability: this.calculateScenarioProbability(bearishPatterns, analysis),
            keyLevels: targets,
            timeframe: '1-3 أسابيع',
            triggers: [
                `كسر مستوى ${targets.support}`,
                'ضعف في حجم التداول الصاعد',
                'تأكيد النمط التصحيحي'
            ],
            invalidation: `إغلاق فوق ${targets.resistance}`,
            description: 'استكمال النمط الهابط أو التصحيحي'
        };
    }

    createSidewaysScenario(analysis, currentPrice) {
        const consolidationPatterns = analysis.patterns.filter(p => 
            p.type === 'triangle' || p.type === 'flat' || p.subtype === 'contracting'
        );
        
        if (consolidationPatterns.length === 0) return null;
        
        const range = this.calculateConsolidationRange(consolidationPatterns, currentPrice);
        
        return {
            direction: 'جانبي',
            probability: this.calculateScenarioProbability(consolidationPatterns, analysis),
            keyLevels: range,
            timeframe: '2-6 أسابيع',
            triggers: [
                'تداول ضمن النطاق المحدد',
                'انخفاض التقلبات',
                'تكوين أنماط توطيد'
            ],
            invalidation: `كسر النطاق ${range.lower} - ${range.upper}`,
            description: 'فترة توطيد وتجميع قبل الحركة التالية'
        };
    }

    calculateBullishTargets(pattern, currentPrice) {
        const fibExt = this.calculateAdvancedFibonacci(
            pattern.startPrice, 
            pattern.endPrice, 
            'impulse'
        );
        
        return {
            support: (currentPrice * 0.95).toFixed(2),
            resistance: (currentPrice * 1.05).toFixed(2),
            target1: fibExt.extensions ? fibExt.extensions['127.2%'] : (currentPrice * 1.1).toFixed(2),
            target2: fibExt.extensions ? fibExt.extensions['161.8%'] : (currentPrice * 1.2).toFixed(2),
            target3: fibExt.extensions ? fibExt.extensions['261.8%'] : (currentPrice * 1.35).toFixed(2)
        };
    }

    calculateBearishTargets(pattern, currentPrice) {
        const fibRet = this.calculateAdvancedFibonacci(
            pattern.startPrice, 
            pattern.endPrice, 
            'corrective'
        );
        
        return {
            resistance: (currentPrice * 1.05).toFixed(2),
            support: (currentPrice * 0.95).toFixed(2),
            target1: fibRet.corrections ? fibRet.corrections['38.2%'] : (currentPrice * 0.9).toFixed(2),
            target2: fibRet.corrections ? fibRet.corrections['61.8%'] : (currentPrice * 0.8).toFixed(2),
            target3: fibRet.corrections ? fibRet.corrections['78.6%'] : (currentPrice * 0.7).toFixed(2)
        };
    }

    calculateConsolidationRange(patterns, currentPrice) {
        let upperBound = currentPrice * 1.1;
        let lowerBound = currentPrice * 0.9;
        
        patterns.forEach(pattern => {
            if (pattern.upperBound) upperBound = Math.min(upperBound, pattern.upperBound);
            if (pattern.lowerBound) lowerBound = Math.max(lowerBound, pattern.lowerBound);
        });
        
        return {
            upper: upperBound.toFixed(2),
            lower: lowerBound.toFixed(2),
            midpoint: ((upperBound + lowerBound) / 2).toFixed(2)
        };
    }

    calculateScenarioProbability(relevantPatterns, analysis) {
        if (relevantPatterns.length === 0) return 0;
        
        const avgConfidence = relevantPatterns.reduce((sum, pattern) => 
            sum + pattern.confidence, 0) / relevantPatterns.length;
        
        const patternWeight = relevantPatterns.length / analysis.patterns.length;
        const timeConsistency = this.checkTimeConsistency(relevantPatterns);
        
        const probability = (avgConfidence * 0.5 + patternWeight * 30 + timeConsistency * 20);
        
        return Math.min(85, Math.max(15, probability)).toFixed(0);
    }

    checkTimeConsistency(patterns) {
        if (patterns.length < 2) return 50;
        
        const timeframes = patterns.map(p => p.timeframe || 'medium');
        const consistentTimeframes = timeframes.filter(tf => tf === timeframes[0]).length;
        
        return (consistentTimeframes / timeframes.length) * 100;
    }

    // تحليل المخاطر المتقدم
    performRiskAnalysis(analysis, currentPrice, portfolioSize = 100000) {
        const riskMetrics = {
            overallRisk: 'متوسط',
            volatilityRisk: this.calculateVolatilityRisk(analysis),
            patternRisk: this.calculatePatternRisk(analysis),
            timeRisk: this.calculateTimeRisk(analysis),
            recommendations: []
        };
        
        // حساب المخاطر الإجمالية
        const totalRiskScore = (
            riskMetrics.volatilityRisk.score + 
            riskMetrics.patternRisk.score + 
            riskMetrics.timeRisk.score
        ) / 3;
        
        if (totalRiskScore > 70) riskMetrics.overallRisk = 'عالي';
        else if (totalRiskScore < 40) riskMetrics.overallRisk = 'منخفض';
        
        // توصيات إدارة المخاطر
        riskMetrics.recommendations = this.generateRiskRecommendations(riskMetrics, portfolioSize);
        
        return riskMetrics;
    }

    calculateVolatilityRisk(analysis) {
        const volatilityPatterns = analysis.patterns.filter(p => 
            p.type === 'impulse' || p.subtype === 'zigzag'
        );
        
        const score = Math.min(100, volatilityPatterns.length * 15);
        
        return {
            score,
            level: score > 60 ? 'عالي' : score > 30 ? 'متوسط' : 'منخفض',
            description: 'مخاطر التقلبات السعرية'
        };
    }

    calculatePatternRisk(analysis) {
        const uncertainPatterns = analysis.patterns.filter(p => p.confidence < 60);
        const score = Math.min(100, (uncertainPatterns.length / analysis.patterns.length) * 100);
        
        return {
            score,
            level: score > 50 ? 'عالي' : score > 25 ? 'متوسط' : 'منخفض',
            description: 'مخاطر عدم تأكد الأنماط'
        };
    }

    calculateTimeRisk(analysis) {
        const longTermPatterns = analysis.patterns.filter(p => 
            p.duration && p.duration > 50
        );
        
        const score = Math.min(100, (longTermPatterns.length / analysis.patterns.length) * 80);
        
        return {
            score,
            level: score > 60 ? 'عالي' : score > 30 ? 'متوسط' : 'منخفض',
            description: 'مخاطر التوقيت الزمني'
        };
    }

    generateRiskRecommendations(riskMetrics, portfolioSize) {
        const recommendations = [];
        
        // توصيات حجم المركز
        let positionSize = 0.02; // 2% افتراضي
        if (riskMetrics.overallRisk === 'عالي') positionSize = 0.01;
        else if (riskMetrics.overallRisk === 'منخفض') positionSize = 0.03;
        
        recommendations.push({
            type: 'حجم المركز',
            value: `${(positionSize * 100).toFixed(1)}% من المحفظة`,
            amount: `${(portfolioSize * positionSize).toFixed(0)} وحدة نقدية`
        });
        // توصيات وقف الخسارة
        let stopLossPercentage = 0.03; // 3% افتراضي
        if (riskMetrics.volatilityRisk.score > 70) stopLossPercentage = 0.05;
        else if (riskMetrics.volatilityRisk.score < 30) stopLossPercentage = 0.02;
        
        recommendations.push({
            type: 'وقف الخسارة',
            value: `${(stopLossPercentage * 100).toFixed(1)}%`,
            description: 'من نقطة الدخول'
        });
        
        // توصيات التنويع
        if (riskMetrics.patternRisk.score > 50) {
            recommendations.push({
                type: 'التنويع',
                value: 'موصى به بشدة',
                description: 'توزيع المخاطر على عدة أدوات مالية'
            });
        }
        
        // توصيات التوقيت
        if (riskMetrics.timeRisk.score > 60) {
            recommendations.push({
                type: 'التوقيت',
                value: 'دخول تدريجي',
                description: 'تقسيم الدخول على عدة مراحل'
            });
        }
        
        return recommendations;
    }

    // تحليل الزخم والقوة
    analyzeMomentum(priceData, volumeData = null) {
        const momentum = {
            trend: this.calculateTrendMomentum(priceData),
            acceleration: this.calculateAcceleration(priceData),
            volume: volumeData ? this.analyzeVolumeProfile(volumeData) : null,
            divergences: this.detectDivergences(priceData),
            strength: 0
        };
        
        // حساب قوة الزخم الإجمالية
        let strengthScore = 0;
        
        if (momentum.trend.strength > 0.7) strengthScore += 30;
        if (momentum.acceleration > 0) strengthScore += 25;
        if (momentum.volume && momentum.volume.trend === 'increasing') strengthScore += 20;
        if (momentum.divergences.length === 0) strengthScore += 25;
        
        momentum.strength = strengthScore;
        momentum.level = strengthScore > 70 ? 'قوي' : strengthScore > 40 ? 'متوسط' : 'ضعيف';
        
        return momentum;
    }

    calculateTrendMomentum(data) {
        const periods = [10, 20, 50];
        const momentums = [];
        
        periods.forEach(period => {
            if (data.length > period) {
                const recent = data.slice(-period);
                const older = data.slice(-period * 2, -period);
                
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
                
                const momentum = (recentAvg - olderAvg) / olderAvg;
                momentums.push({ period, momentum });
            }
        });
        
        const avgMomentum = momentums.reduce((sum, m) => sum + m.momentum, 0) / momentums.length;
        
        return {
            value: avgMomentum.toFixed(4),
            strength: Math.abs(avgMomentum),
            direction: avgMomentum > 0 ? 'صاعد' : 'هابط',
            periods: momentums
        };
    }

    calculateAcceleration(data) {
        if (data.length < 6) return 0;
        
        const recent = data.slice(-3);
        const middle = data.slice(-6, -3);
        
        const recentChange = recent[recent.length - 1] - recent[0];
        const middleChange = middle[middle.length - 1] - middle[0];
        
        return recentChange - middleChange;
    }

    analyzeVolumeProfile(volumeData) {
        const recentVolume = volumeData.slice(-20);
        const olderVolume = volumeData.slice(-40, -20);
        
        const recentAvg = recentVolume.reduce((a, b) => a + b, 0) / recentVolume.length;
        const olderAvg = olderVolume.reduce((a, b) => a + b, 0) / olderVolume.length;
        
        const volumeRatio = recentAvg / olderAvg;
        
        return {
            ratio: volumeRatio.toFixed(2),
            trend: volumeRatio > 1.2 ? 'increasing' : volumeRatio < 0.8 ? 'decreasing' : 'stable',
            significance: volumeRatio > 1.5 ? 'عالية' : volumeRatio > 1.2 ? 'متوسطة' : 'منخفضة'
        };
    }

    detectDivergences(priceData) {
        const divergences = [];
        const windowSize = 20;
        
        for (let i = windowSize; i < priceData.length - windowSize; i++) {
            const leftSegment = priceData.slice(i - windowSize, i);
            const rightSegment = priceData.slice(i, i + windowSize);
            
            const leftTrend = this.calculateTrend(leftSegment);
            const rightTrend = this.calculateTrend(rightSegment);
            
            // البحث عن تباعد في الاتجاهات
            if (Math.abs(leftTrend - rightTrend) > 0.5) {
                divergences.push({
                    index: i,
                    type: leftTrend > rightTrend ? 'bearish_divergence' : 'bullish_divergence',
                    strength: Math.abs(leftTrend - rightTrend).toFixed(2)
                });
            }
        }
        
        return divergences;
    }

    // تحليل مستويات الدعم والمقاومة الديناميكية
    calculateDynamicLevels(priceData, patterns) {
        const levels = {
            support: [],
            resistance: [],
            dynamic: []
        };
        
        // مستويات من الأنماط
        patterns.forEach(pattern => {
            if (pattern.type === 'impulse') {
                levels.support.push({
                    price: pattern.startPrice,
                    strength: pattern.confidence,
                    type: 'pattern_support',
                    description: `دعم من بداية الموجة الدافعة`
                });
            }
            
            if (pattern.type === 'triangle') {
                levels.support.push({
                    price: pattern.lowerBound,
                    strength: pattern.confidence,
                    type: 'triangle_support'
                });
                levels.resistance.push({
                    price: pattern.upperBound,
                    strength: pattern.confidence,
                    type: 'triangle_resistance'
                });
            }
        });
        
        // مستويات فيبوناتشي ديناميكية
        const fibLevels = this.calculateDynamicFibonacci(priceData);
        levels.dynamic = fibLevels;
        
        // ترتيب المستويات حسب القوة
        levels.support.sort((a, b) => b.strength - a.strength);
        levels.resistance.sort((a, b) => b.strength - a.strength);
        
        return levels;
    }

    calculateDynamicFibonacci(data) {
        const dynamicLevels = [];
        const swingHigh = Math.max(...data.slice(-50));
        const swingLow = Math.min(...data.slice(-50));
        const range = swingHigh - swingLow;
        
        const fibRatios = [0.236, 0.382, 0.5, 0.618, 0.786];
        
        fibRatios.forEach(ratio => {
            const level = swingLow + (range * ratio);
            dynamicLevels.push({
                price: level.toFixed(2),
                ratio: `${(ratio * 100).toFixed(1)}%`,
                type: 'fibonacci_retracement',
                strength: ratio === 0.618 ? 90 : ratio === 0.5 ? 80 : 70
            });
        });
        
        return dynamicLevels;
    }

    // تحليل الدورات الزمنية
    analyzeCycles(priceData, timeData) {
        const cycles = {
            short: this.detectShortCycles(priceData),
            medium: this.detectMediumCycles(priceData),
            long: this.detectLongCycles(priceData),
            fibonacci: this.analyzeFibonacciTime(timeData)
        };
        
        return cycles;
    }

    detectShortCycles(data) {
        const cycles = [];
        const windowSize = 10;
        
        for (let period = 3; period <= 15; period++) {
            let matches = 0;
            
            for (let i = period; i < data.length - period; i += period) {
                const current = data[i];
                const next = data[i + period] || data[data.length - 1];
                
                if (Math.abs(current - next) / current < 0.05) {
                    matches++;
                }
            }
            
            const confidence = (matches / Math.floor(data.length / period)) * 100;
            
            if (confidence > 60) {
                cycles.push({
                    period,
                    confidence: confidence.toFixed(1),
                    type: 'short_cycle',
                    description: `دورة قصيرة ${period} فترة`
                });
            }
        }
        
        return cycles.sort((a, b) => b.confidence - a.confidence);
    }

    detectMediumCycles(data) {
        // دورات متوسطة (20-89 فترة)
        const cycles = [];
        
        for (let period = 20; period <= 89; period += 5) {
            const cycleStrength = this.calculateCycleStrength(data, period);
            
            if (cycleStrength > 0.6) {
                cycles.push({
                    period,
                    strength: cycleStrength.toFixed(2),
                    type: 'medium_cycle',
                    nextTurn: this.predictNextTurn(data, period)
                });
            }
        }
        
        return cycles;
    }

    detectLongCycles(data) {
        // دورات طويلة (144+ فترة)
        const cycles = [];
        const fibPeriods = [144, 233, 377, 610];
        
        fibPeriods.forEach(period => {
            if (data.length > period * 2) {
                const strength = this.calculateCycleStrength(data, period);
                
                if (strength > 0.5) {
                    cycles.push({
                        period,
                        strength: strength.toFixed(2),
                        type: 'long_cycle',
                        fibonacci: true,
                        significance: 'عالية - دورة فيبوناتشي'
                    });
                }
            }
        });
        
        return cycles;
    }

    calculateCycleStrength(data, period) {
        let correlationSum = 0;
        let count = 0;
        
        for (let i = 0; i < data.length - period; i++) {
            if (i + period * 2 < data.length) {
                const val1 = data[i];
                const val2 = data[i + period];
                const val3 = data[i + period * 2];
                
                const corr1 = Math.abs(val1 - val2) / Math.max(val1, val2);
                const corr2 = Math.abs(val2 - val3) / Math.max(val2, val3);
                
                correlationSum += (1 - corr1) * (1 - corr2);
                count++;
            }
        }
        
        return count > 0 ? correlationSum / count : 0;
    }

    predictNextTurn(data, period) {
        const lastCycleStart = data.length - (data.length % period);
        const remainingPeriods = period - (data.length - lastCycleStart);
        
        return {
            periodsRemaining: remainingPeriods,
            expectedDirection: this.predictTurnDirection(data, period),
            confidence: this.calculatePredictionConfidence(data, period)
        };
    }

    predictTurnDirection(data, period) {
        const recentCycles = Math.floor(data.length / period);
        let upTurns = 0;
        let downTurns = 0;
        
        for (let i = 1; i < recentCycles; i++) {
            const cycleStart = data[i * period];
            const cycleEnd = data[(i + 1) * period - 1];
            
            if (cycleEnd > cycleStart) upTurns++;
            else downTurns++;
        }
        
        return upTurns > downTurns ? 'صاعد' : 'هابط';
    }

    calculatePredictionConfidence(data, period) {
        const consistency = this.calculateCycleStrength(data, period);
        return Math.min(85, consistency * 100).toFixed(0);
    }

    analyzeFibonacciTime(timeData) {
        const fibNumbers = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
        const timeAnalysis = [];
        
        fibNumbers.forEach(fib => {
            if (timeData && timeData.length > fib) {
                const significance = this.checkTimeSignificance(timeData, fib);
                
                if (significance > 0.6) {
                    timeAnalysis.push({
                        fibonacci: fib,
                        significance: significance.toFixed(2),
                        description: `نقطة زمنية مهمة كل ${fib} فترة`,
                        nextOccurrence: this.calculateNextFibTime(timeData, fib)
                    });
                }
            }
        });
        
        return timeAnalysis;
    }

    checkTimeSignificance(timeData, fibNumber) {
        let significantEvents = 0;
        let totalChecks = 0;
        
        for (let i = fibNumber; i < timeData.length; i += fibNumber) {
            const event = timeData[i];
            const baseline = timeData.slice(Math.max(0, i - 5), i + 5);
            const avgBaseline = baseline.reduce((a, b) => a + b, 0) / baseline.length;
            
            if (Math.abs(event - avgBaseline) / avgBaseline > 0.02) {
                significantEvents++;
            }
            totalChecks++;
        }
        return totalChecks > 0 ? significantEvents / totalChecks : 0;
    }

    calculateNextFibTime(timeData, fibNumber) {
        const lastIndex = timeData.length - 1;
        const nextFibIndex = Math.ceil((lastIndex + 1) / fibNumber) * fibNumber;
        const periodsUntilNext = nextFibIndex - lastIndex;
        
        return {
            periodsRemaining: periodsUntilNext,
            expectedIndex: nextFibIndex,
            probability: 'متوسطة إلى عالية'
        };
    }

    // تحليل التقارب والتباعد المتقدم
    analyzeAdvancedDivergences(priceData, indicators = {}) {
        const divergences = {
            price: this.analyzePriceDivergences(priceData),
            momentum: indicators.momentum ? this.analyzeMomentumDivergences(priceData, indicators.momentum) : null,
            volume: indicators.volume ? this.analyzeVolumeDivergences(priceData, indicators.volume) : null,
            composite: []
        };
        
        // تحليل التباعد المركب
        divergences.composite = this.createCompositeDivergence(divergences);
        
        return divergences;
    }

    analyzePriceDivergences(data) {
        const divergences = [];
        const swingPoints = this.identifySwingPoints(data);
        
        for (let i = 2; i < swingPoints.length; i++) {
            const point1 = swingPoints[i-2];
            const point2 = swingPoints[i-1];
            const point3 = swingPoints[i];
            
            if (point1.type === point3.type) { // نفس نوع النقطة (قمة أو قاع)
                const priceDirection = point3.value > point1.value ? 'higher' : 'lower';
                
                if (point1.type === 'peak' && priceDirection === 'lower') {
                    divergences.push({
                        type: 'bearish_divergence',
                        points: [point1, point3],
                        strength: this.calculateDivergenceStrength(point1, point3),
                        description: 'قمم منخفضة - إشارة هبوطية'
                    });
                } else if (point1.type === 'trough' && priceDirection === 'higher') {
                    divergences.push({
                        type: 'bullish_divergence',
                        points: [point1, point3],
                        strength: this.calculateDivergenceStrength(point1, point3),
                        description: 'قيعان مرتفعة - إشارة صعودية'
                    });
                }
            }
        }
        
        return divergences;
    }

    identifySwingPoints(data) {
        const swingPoints = [];
        const lookback = 5;
        
        for (let i = lookback; i < data.length - lookback; i++) {
            const segment = data.slice(i - lookback, i + lookback + 1);
            const centerValue = segment[lookback];
            
            const isPeak = segment.every((val, idx) => idx === lookback || val <= centerValue);
            const isTrough = segment.every((val, idx) => idx === lookback || val >= centerValue);
            
            if (isPeak) {
                swingPoints.push({
                    index: i,
                    value: centerValue,
                    type: 'peak'
                });
            } else if (isTrough) {
                swingPoints.push({
                    index: i,
                    value: centerValue,
                    type: 'trough'
                });
            }
        }
        
        return swingPoints;
    }

    calculateDivergenceStrength(point1, point2) {
        const priceChange = Math.abs(point2.value - point1.value) / point1.value;
        const timeDistance = Math.abs(point2.index - point1.index);
        
        let strength = priceChange * 100;
        
        // تعديل القوة حسب المسافة الزمنية
        if (timeDistance > 50) strength *= 1.2; // تباعد طويل المدى أقوى
        if (timeDistance < 10) strength *= 0.8; // تباعد قصير المدى أضعف
        
        return Math.min(100, strength).toFixed(1);
    }

    analyzeMomentumDivergences(priceData, momentumData) {
        const pricePeaks = this.findPeaks(priceData);
        const momentumPeaks = this.findPeaks(momentumData);
        
        const divergences = [];
        
        // مقارنة القمم
        for (let i = 1; i < pricePeaks.length && i < momentumPeaks.length; i++) {
            const priceDirection = priceData[pricePeaks[i]] > priceData[pricePeaks[i-1]] ? 'higher' : 'lower';
            const momentumDirection = momentumData[momentumPeaks[i]] > momentumData[momentumPeaks[i-1]] ? 'higher' : 'lower';
            
            if (priceDirection !== momentumDirection) {
                divergences.push({
                    type: priceDirection === 'higher' ? 'bearish_momentum_divergence' : 'bullish_momentum_divergence',
                    pricePoints: [pricePeaks[i-1], pricePeaks[i]],
                    momentumPoints: [momentumPeaks[i-1], momentumPeaks[i]],
                    significance: 'عالية - تباعد الزخم'
                });
            }
        }
        
        return divergences;
    }

    analyzeVolumeDivergences(priceData, volumeData) {
        const divergences = [];
        const priceSwings = this.identifySwingPoints(priceData);
        
        priceSwings.forEach((swing, index) => {
            if (index > 0) {
                const prevSwing = priceSwings[index - 1];
                const currentVolume = volumeData[swing.index];
                const prevVolume = volumeData[prevSwing.index];
                
                const priceIncrease = swing.value > prevSwing.value;
                const volumeIncrease = currentVolume > prevVolume;
                
                if (priceIncrease && !volumeIncrease) {
                    divergences.push({
                        type: 'volume_divergence',
                        subtype: 'weak_rally',
                        description: 'ارتفاع سعري بحجم ضعيف',
                        significance: 'تحذيرية'
                    });
                } else if (!priceIncrease && volumeIncrease) {
                    divergences.push({
                        type: 'volume_divergence',
                        subtype: 'strong_decline',
                        description: 'انخفاض سعري بحجم قوي',
                        significance: 'هبوطية قوية'
                    });
                }
            }
        });
        
        return divergences;
    }

    createCompositeDivergence(divergences) {
        const composite = [];
        
        // دمج التباعدات المختلفة
        if (divergences.price.length > 0 && divergences.momentum && divergences.momentum.length > 0) {
            const priceDiv = divergences.price[0];
            const momentumDiv = divergences.momentum[0];
            
            if (priceDiv.type.includes(momentumDiv.type.split('_')[0])) {
                composite.push({
                    type: 'strong_composite_divergence',
                    components: ['price', 'momentum'],
                    direction: priceDiv.type.includes('bullish') ? 'صعودي' : 'هبوطي',
                    strength: 'عالية جداً',
                    reliability: '85%'
                });
            }
        }
        
        return composite;
    }

    // تحليل الأهداف السعرية المتقدمة
    calculateAdvancedTargets(patterns, currentPrice) {
        const targets = {
            immediate: [],
            intermediate: [],
            longTerm: [],
            fibonacci: [],
            elliott: []
        };
        
        patterns.forEach(pattern => {
            // أهداف فورية (1-5 أيام)
            const immediateTarget = this.calculateImmediateTarget(pattern, currentPrice);
            if (immediateTarget) targets.immediate.push(immediateTarget);
            
            // أهداف متوسطة (1-4 أسابيع)
            const intermediateTarget = this.calculateIntermediateTarget(pattern, currentPrice);
            if (intermediateTarget) targets.intermediate.push(intermediateTarget);
            
            // أهداف طويلة المدى (1-6 أشهر)
            const longTermTarget = this.calculateLongTermTarget(pattern, currentPrice);
            if (longTermTarget) targets.longTerm.push(longTermTarget);
            
            // أهداف فيبوناتشي
            const fibTargets = this.calculateFibonacciTargets(pattern, currentPrice);
            targets.fibonacci.push(...fibTargets);
            
            // أهداف إليوت
            const elliottTargets = this.calculateElliottTargets(pattern, currentPrice);
            targets.elliott.push(...elliottTargets);
        });
        
        // ترتيب الأهداف حسب الاحتمالية
        Object.keys(targets).forEach(key => {
            targets[key].sort((a, b) => b.probability - a.probability);
        });
        
        return targets;
    }

    calculateImmediateTarget(pattern, currentPrice) {
        if (pattern.type === 'impulse' && pattern.confidence > 70) {
            const direction = pattern.direction === 'bullish' ? 1 : -1;
            const volatility = this.calculateVolatility(pattern);
            
            return {
                price: (currentPrice * (1 + direction * volatility * 0.5)).toFixed(2),
                probability: pattern.confidence,
                timeframe: '1-5 أيام',
                basis: 'تحليل الزخم قصير المدى'
            };
        }
        return null;
    }

    calculateIntermediateTarget(pattern, currentPrice) {
        if (pattern.confidence > 60) {
            const fibLevel = pattern.direction === 'bullish' ? 1.272 : 0.786;
            const range = Math.abs(pattern.endPrice - pattern.startPrice);
            
            return {
                price: (currentPrice + (pattern.direction === 'bullish' ? range * 0.272 : -range * 0.214)).toFixed(2),
                probability: pattern.confidence * 0.8,
                timeframe: '1-4 أسابيع',
                basis: 'إسقاط النمط المتوسط'
            };
        }
        return null;
    }

    calculateLongTermTarget(pattern, currentPrice) {
        if (pattern.type === 'impulse' && pattern.confidence > 65) {
            const majorMove = Math.abs(pattern.endPrice - pattern.startPrice) * 1.618;
            const direction = pattern.direction === 'bullish' ? 1 : -1;
            
            return {
                price: (currentPrice + direction * majorMove).toFixed(2),
                probability: pattern.confidence * 0.6,
                timeframe: '1-6 أشهر',
                basis: 'إسقاط الموجة الكبرى'
            };
        }
        return null;
    }

    calculateFibonacciTargets(pattern, currentPrice) {
        const targets = [];
        const range = Math.abs(pattern.endPrice - pattern.startPrice);
        const direction = pattern.direction === 'bullish' ? 1 : -1;
        
        const fibRatios = [1.272, 1.414, 1.618, 2.0, 2.618];
        
        fibRatios.forEach(ratio => {
            targets.push({
                price: (currentPrice + direction * range * (ratio - 1)).toFixed(2),
                ratio: ratio,
                probability: this.calculateFibProbability(ratio, pattern.confidence),
                basis: `فيبوناتشي ${ratio}`
            });
        });
        
        return targets;
    }

    calculateElliottTargets(pattern, currentPrice) {
        const targets = [];
        
        if (pattern.type === 'impulse') {
            // هدف الموجة 3 = 1.618 × الموجة 1
            if (pattern.currentWave === 2) {
                const wave1Length = Math.abs(pattern.endPrice - pattern.startPrice);
                targets.push({
                    price: (currentPrice + wave1Length * 1.618).toFixed(2),
                    wave: 'الموجة 3',
                    probability: 80,
                    basis: 'قاعدة إليوت - الموجة 3'
                });
            }
            
            // هدف الموجة 5 = الموجة 1
            if (pattern.currentWave === 4) {
                const wave1Length = Math.abs(pattern.endPrice - pattern.startPrice);
                targets.push({
                    price: (currentPrice + wave1Length).toFixed(2),
                    wave: 'الموجة 5',
                    probability: 70,
                    basis: 'قاعدة إليوت - الموجة 5'
                });
            }
        }
        
        return targets;
    }

    calculateFibProbability(ratio, patternConfidence) {
        const fibImportance = {
            1.272: 0.7,
            1.414: 0.6,
            1.618: 0.9,
            2.0: 0.5,
            2.618: 0.8
        };
        
        return Math.round(patternConfidence * (fibImportance[ratio] || 0.5));
    }

    calculateVolatility(pattern) {
        if (!pattern.priceData) return 0.02; // افتراضي 2%
        
        const returns = [];
        for (let i = 1; i < pattern.priceData.length; i++) {
            returns.push((pattern.priceData[i] - pattern.priceData[i-1]) / pattern.priceData[i-1]);
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    // تحليل السيناريوهات المتعددة
    generateMultipleScenarios(analysis, currentPrice, marketConditions = {}) {
        const scenarios = [];
        
               // السيناريو الأساسي (الأكثر احتمالاً)
        const primaryScenario = this.createPrimaryScenario(analysis, currentPrice);
        scenarios.push(primaryScenario);
        
        // السيناريو البديل
        const alternativeScenario = this.createAlternativeScenario(analysis, currentPrice);
        scenarios.push(alternativeScenario);
        
        // سيناريو الصدمة
        const shockScenario = this.createShockScenario(analysis, currentPrice, marketConditions);
        scenarios.push(shockScenario);
        
        // سيناريو التوطيد
        const consolidationScenario = this.createConsolidationScenario(analysis, currentPrice);
        scenarios.push(consolidationScenario);
        
        return scenarios.sort((a, b) => b.probability - a.probability);
    }

    createPrimaryScenario(analysis, currentPrice) {
        const strongestPattern = analysis.patterns.reduce((prev, current) => 
            (prev.confidence > current.confidence) ? prev : current
        );
        
        return {
            name: 'السيناريو الأساسي',
            probability: strongestPattern.confidence,
            direction: strongestPattern.direction,
            timeframe: '2-6 أسابيع',
            keyLevels: this.calculateScenarioLevels(strongestPattern, currentPrice),
            triggers: this.identifyScenarioTriggers(strongestPattern),
            risks: this.assessScenarioRisks(strongestPattern),
            description: `استكمال ${strongestPattern.type} ${strongestPattern.direction}`,
            actionPlan: this.createActionPlan(strongestPattern, currentPrice)
        };
    }

    createAlternativeScenario(analysis, currentPrice) {
        const alternativePatterns = analysis.patterns.filter(p => 
            p.confidence > 50 && p.direction !== analysis.patterns[0].direction
        );
        
        const altPattern = alternativePatterns.length > 0 ? alternativePatterns[0] : null;
        
        if (!altPattern) {
            return {
                name: 'السيناريو البديل',
                probability: 25,
                description: 'لا يوجد نمط بديل واضح',
                direction: 'غير محدد'
            };
        }
        
        return {
            name: 'السيناريو البديل',
            probability: altPattern.confidence * 0.7,
            direction: altPattern.direction,
            timeframe: '1-4 أسابيع',
            keyLevels: this.calculateScenarioLevels(altPattern, currentPrice),
            description: `تحول إلى ${altPattern.type} ${altPattern.direction}`,
            conditions: 'في حالة فشل السيناريو الأساسي'
        };
    }

    createShockScenario(analysis, currentPrice, marketConditions) {
        const volatility = this.calculateMarketVolatility(analysis);
        const shockMagnitude = volatility * 2.5;
        
        return {
            name: 'سيناريو الصدمة',
            probability: 15,
            direction: 'متقلب',
            timeframe: 'فوري - أسبوع',
            shockUp: (currentPrice * (1 + shockMagnitude)).toFixed(2),
            shockDown: (currentPrice * (1 - shockMagnitude)).toFixed(2),
            triggers: [
                'أخبار اقتصادية مفاجئة',
                'تغيرات جيوسياسية',
                'قرارات البنوك المركزية'
            ],
            preparation: 'وضع أوامر وقف خسارة محكمة',
            description: 'حركة سعرية حادة غير متوقعة'
        };
    }

    createConsolidationScenario(analysis, currentPrice) {
        const consolidationPatterns = analysis.patterns.filter(p => 
            p.type === 'triangle' || p.type === 'flat'
        );
        
        const avgRange = this.calculateAverageRange(analysis.priceData || []);
        
        return {
            name: 'سيناريو التوطيد',
            probability: consolidationPatterns.length > 0 ? 40 : 20,
            direction: 'جانبي',
            timeframe: '3-8 أسابيع',
            upperBound: (currentPrice * 1.05).toFixed(2),
            lowerBound: (currentPrice * 0.95).toFixed(2),
            breakoutTarget: (currentPrice * 1.12).toFixed(2),
            breakdownTarget: (currentPrice * 0.88).toFixed(2),
            description: 'فترة توطيد قبل الحركة الكبيرة التالية',
            strategy: 'تداول النطاق أو انتظار الكسر'
        };
    }

    calculateScenarioLevels(pattern, currentPrice) {
        const range = Math.abs(pattern.endPrice - pattern.startPrice);
        const direction = pattern.direction === 'bullish' ? 1 : -1;
        
        return {
            entry: currentPrice,
            target1: (currentPrice + direction * range * 0.382).toFixed(2),
            target2: (currentPrice + direction * range * 0.618).toFixed(2),
            target3: (currentPrice + direction * range * 1.0).toFixed(2),
            stopLoss: (currentPrice - direction * range * 0.236).toFixed(2)
        };
    }

    identifyScenarioTriggers(pattern) {
        const triggers = [];
        
        if (pattern.type === 'impulse') {
            triggers.push('كسر مستوى المقاومة الرئيسي');
            triggers.push('زيادة حجم التداول');
            triggers.push('تأكيد الموجة الدافعة');
        }
        
        if (pattern.type === 'corrective') {
            triggers.push('اكتمال النمط التصحيحي');
            triggers.push('اختبار مستوى الدعم');
            triggers.push('إشارات انعكاس');
        }
        
        return triggers;
    }

    assessScenarioRisks(pattern) {
        const risks = [];
        
        if (pattern.confidence < 70) {
            risks.push('عدم تأكد النمط');
        }
        
        if (pattern.type === 'triangle') {
            risks.push('احتمالية الكسر الكاذب');
        }
        
        risks.push('تغير الظروف السوقية');
        risks.push('تأثير الأخبار الخارجية');
        
        return risks;
    }

    createActionPlan(pattern, currentPrice) {
        const plan = {
            immediate: [],
            shortTerm: [],
            longTerm: []
        };
        
        // إجراءات فورية
        plan.immediate.push('مراقبة مستويات الدعم والمقاومة');
        plan.immediate.push('تحديد نقاط الدخول المثلى');
        
        // إجراءات قصيرة المدى
        plan.shortTerm.push('تنفيذ استراتيجية التداول');
        plan.shortTerm.push('إدارة المخاطر بعناية');
        
        // إجراءات طويلة المدى
        plan.longTerm.push('مراجعة وتحديث التحليل');
        plan.longTerm.push('تقييم الأداء والنتائج');
        
        return plan;
    }

    calculateMarketVolatility(analysis) {
        const patterns = analysis.patterns;
        let totalVolatility = 0;
        
        patterns.forEach(pattern => {
            if (pattern.priceData) {
                totalVolatility += this.calculateVolatility(pattern);
            }
        });
        
        return patterns.length > 0 ? totalVolatility / patterns.length : 0.02;
    }

    // تحليل الأداء والتحقق من صحة التوقعات
    validatePredictions(previousAnalysis, actualData, timeframe) {
        const validation = {
            accuracy: 0,
            successfulPredictions: 0,
            totalPredictions: 0,
            detailedResults: [],
            improvements: []
        };
        
        if (!previousAnalysis || !actualData) {
            return validation;
        }
        
        // التحقق من دقة توقعات الأنماط
        previousAnalysis.patterns.forEach(pattern => {
            const result = this.validatePatternPrediction(pattern, actualData);
            validation.detailedResults.push(result);
            
            if (result.success) {
                validation.successfulPredictions++;
            }
            validation.totalPredictions++;
        });
        
        // حساب الدقة الإجمالية
        validation.accuracy = validation.totalPredictions > 0 ? 
            (validation.successfulPredictions / validation.totalPredictions * 100).toFixed(1) : 0;
        
        // اقتراح التحسينات
        validation.improvements = this.suggestImprovements(validation.detailedResults);
        
        return validation;
    }

    validatePatternPrediction(pattern, actualData) {
        const result = {
            patternType: pattern.type,
            predictedDirection: pattern.direction,
            confidence: pattern.confidence,
            success: false,
            actualOutcome: 'غير محدد',
            accuracy: 0,
            notes: []
        };
        
        // تحديد النتيجة الفعلية
        const startPrice = actualData[0];
        const endPrice = actualData[actualData.length - 1];
        const actualDirection = endPrice > startPrice ? 'bullish' : 'bearish';
        
        result.actualOutcome = actualDirection;
        
        // تقييم النجاح
        if (pattern.direction === actualDirection) {
            result.success = true;
            result.accuracy = Math.min(100, pattern.confidence + 10);
            result.notes.push('توقع الاتجاه صحيح');
        } else {
            result.accuracy = Math.max(0, pattern.confidence - 30);
            result.notes.push('توقع الاتجاه خاطئ');
        }
        
        // تقييم مستويات الأهداف
        if (pattern.targets) {
            const targetHits = this.checkTargetHits(pattern.targets, actualData);
            result.notes.push(`تحقق ${targetHits.hits}/${targetHits.total} من الأهداف`);
        }
        
        return result;
    }

    checkTargetHits(targets, actualData) {
        let hits = 0;
        const total = targets.length;
        
        const maxPrice = Math.max(...actualData);
        const minPrice = Math.min(...actualData);
        
        targets.forEach(target => {
            const targetPrice = parseFloat(target.price);
            if (targetPrice >= minPrice && targetPrice <= maxPrice) {
                hits++;
            }
        });
        
        return { hits, total };
    }

    suggestImprovements(results) {
        const improvements = [];
        
        const lowAccuracyResults = results.filter(r => r.accuracy < 60);
        if (lowAccuracyResults.length > results.length * 0.3) {
            improvements.push('تحسين معايير تحديد الأنماط');
            improvements.push('زيادة فترة التحليل للحصول على بيانات أكثر');
        }
        
        const wrongDirections = results.filter(r => !r.success);
        if (wrongDirections.length > results.length * 0.4) {
            improvements.push('إعادة تقييم مؤشرات الاتجاه');
            improvements.push('دمج مؤشرات إضافية للتأكيد');
        }
        
        improvements.push('مراجعة دورية للمعايير والخوارزميات');
        improvements.push('تحديث قاعدة البيانات التاريخية');
        
        return improvements;
    }

    // تصدير التحليل الكامل
    exportCompleteAnalysis(analysis, options = {}) {
        const completeReport = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                analysisType: 'Elliott Wave Advanced',
                dataPoints: analysis.dataLength || 0
            },
            
            executive_summary: {
                primaryTrend: analysis.primaryTrend || 'غير محدد',
                confidence: analysis.overallConfidence || 0,
                keyFindings: this.extractKeyFindings(analysis),
                recommendations: this.generateExecutiveRecommendations(analysis)
            },
            
            detailed_analysis: {
                patterns: analysis.patterns || [],
                waves: analysis.waves || [],
                fibonacci: analysis.fibonacciLevels || {},
                cycles: analysis.cycles || {},
                momentum: analysis.momentum || {},
                divergences: analysis.divergences || {}
            },
            
            trading_opportunities: analysis.opportunities || [],
            risk_assessment: analysis.riskAnalysis || {},
            scenarios: analysis.scenarios || [],
            targets: analysis.targets || {},
            
            technical_details: {
                calculations: options.includeCalculations ? this.getCalculationDetails(analysis) : null,
                rawData: options.includeRawData ? analysis.rawData : null,
                parameters: analysis.parameters || {}
            },
            
            validation: analysis.validation || null,
            
            disclaimer: this.getDisclaimer()
        };
        
        return completeReport;
    }

    extractKeyFindings(analysis) {
        const findings = [];
        
        if (analysis.patterns && analysis.patterns.length > 0) {
            const strongPatterns = analysis.patterns.filter(p => p.confidence > 70);
            findings.push(`تم تحديد ${strongPatterns.length} نمط قوي من أصل ${analysis.patterns.length}`);
        }
        
        if (analysis.momentum && analysis.momentum.strength > 70) {
            findings.push(`زخم قوي في الاتجاه ${analysis.momentum.trend?.direction || 'الحالي'}`);
        }
        
        if (analysis.divergences && analysis.divergences.composite.length > 0) {
            findings.push('وجود تباعدات مركبة تشير لتغير محتمل في الاتجاه');
        }
        
        return findings;
    }

    generateExecutiveRecommendations(analysis) {
        const recommendations = [];
        
        if (analysis.opportunities && analysis.opportunities.length > 0) {
            const bestOpp = analysis.opportunities[0];
            recommendations.push(`فرصة ${bestOpp.direction} مع نسبة مخاطرة/عائد ${bestOpp.riskReward}`);
        }
        
        if (analysis.riskAnalysis && analysis.riskAnalysis.overallRisk === 'عالي') {
            recommendations.push('توخي الحذر الشديد وتقليل حجم المراكز');
        }
        
        if (analysis.scenarios && analysis.scenarios.length > 0) {
            const primaryScenario = analysis.scenarios[0];
            recommendations.push(`التركيز على السيناريو ${primaryScenario.name} بنسبة احتمال ${primaryScenario.probability}%`);
        }
        
        recommendations.push('مراجعة التحليل كل 24-48 ساعة');
        recommendations.push('الالتزام بخطة إدارة المخاطر المحددة');
        
        return recommendations;
    }

    getCalculationDetails(analysis) {
        return {
            fibonacciCalculations: 'تم استخدام نسب فيبوناتشي الكلاسيكية والمتقدمة',
            waveCountingMethod: 'قواعد إليوت الأساسية مع التحديثات الحديثة',
            confidenceScoring: 'نظام تسجيل متعدد المعايير',
            riskCalculations: 'تحليل المخاطر متعدد الأبعاد'
        };
    }

    getDisclaimer() {
        return {
            arabic: 'هذا التحليل مخصص للأغراض التعليمية والمعلوماتية فقط. لا يشكل نصيحة استثمارية. يجب استشارة مستشار مالي مؤهل قبل اتخاذ أي قرارات استثمارية. الأسواق المالية تنطوي على مخاطر عالية وقد تؤدي إلى خسائر كبيرة.',
            english: 'This analysis is for educational and informational purposes only. It does not constitute investment advice. Please consult with a qualified financial advisor before making any investment decisions. Financial markets involve high risk and may result in significant losses.'
        };
    }

    // دالة التحليل الرئيسية المحدثة
    async analyzeAdvanced(priceData, options = {}) {
        try {
            // التحقق من صحة البيانات
            if (!this.validateInputData(priceData)) {
                throw new Error('بيانات الأسعار غير صالحة');
            }

            const analysis = {
                timestamp: new Date().toISOString(),
                dataLength: priceData.length,
                currentPrice: priceData[priceData.length - 1],
                parameters: options
            };

            // 1. تحليل الأنماط الأساسية
            console.log('🔍 بدء تحليل الأنماط...');
            analysis.patterns = this.identifyElliottPatterns(priceData);
            
            // 2. تحليل الموجات المتقدم
            console.log('🌊 تحليل الموجات...');
            analysis.waves = this.analyzeWaveStructure(priceData);
            
            // 3. حساب مستويات فيبوناتشي المتقدمة
            console.log('📐 حساب مستويات فيبوناتشي...');
            analysis.fibonacciLevels = this.calculateComprehensiveFibonacci(priceData);
            
            // 4. تحليل الدورات الزمنية
            console.log('⏰ تحليل الدورات الزمنية...');
            analysis.cycles = this.analyzeCycles(priceData, options.timeData);
            
            // 5. تحليل الزخم والقوة
            console.log('⚡ تحليل الزخم...');
            analysis.momentum = this.analyzeMomentum(priceData, options.volumeData);
            
            // 6. تحليل التباعدات المتقدم
            console.log('📊 تحليل التباعدات...');
            analysis.divergences = this.analyzeAdvancedDivergences(priceData, options.indicators);
            
            // 7. تحديد الفرص التجارية
            console.log('💰 تحديد الفرص التجارية...');
            analysis.opportunities = this.identifyTradingOpportunities(analysis, analysis.currentPrice);
            
            // 8. تحليل المخاطر
            console.log('⚠️ تحليل المخاطر...');
            analysis.riskAnalysis = this.performRiskAnalysis(analysis, analysis.currentPrice, options.portfolioSize);
            
            // 9. توليد السيناريوهات
            console.log('🎯 توليد السيناريوهات...');
            analysis.scenarios = this.generateMultipleScenarios(analysis, analysis.currentPrice, options.marketConditions);
            
            // 10. حساب الأهداف السعرية
            console.log('🎯 حساب الأهداف السعرية...');
            analysis.targets = this.calculateAdvancedTargets(analysis.patterns, analysis.currentPrice);
            
            // 11. حساب مستويات الدعم والمقاومة الديناميكية
            console.log('📈 حساب المستويات الديناميكية...');
            analysis.dynamicLevels = this.calculateDynamicLevels(priceData, analysis.patterns);
            
            // 12. تقييم الثقة الإجمالية
            analysis.overallConfidence = this.calculateOverallConfidence(analysis);
            analysis.primaryTrend = this.determinePrimaryTrend(analysis);
            
            // 13. التحقق من صحة التوقعات (إذا توفرت بيانات سابقة)
            if (options.previousAnalysis && options.actualData) {
                console.log('✅ التحقق من صحة التوقعات...');
                analysis.validation = this.validatePredictions(
                    options.previousAnalysis, 
                    options.actualData, 
                    options.timeframe
                );
            }
            
            console.log('✅ اكتمل التحليل بنجاح');
            
            // إرجاع التحليل الكامل أو المبسط حسب الطلب
            return options.fullReport ? 
                this.exportCompleteAnalysis(analysis, options) : 
                this.createSummaryReport(analysis);
                
        } catch (error) {
            console.error('❌ خطأ في التحليل:', error.message);
            return {
                error: true,
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    validateInputData(data) {
        if (!Array.isArray(data)) return false;
        if (data.length < 20) return false;
        if (data.some(price => typeof price !== 'number' || price <= 0)) return false;
        return true;
    }

    calculateOverallConfidence(analysis) {
        let totalConfidence = 0;
        let factors = 0;
        
        // ثقة الأنماط
        if (analysis.patterns && analysis.patterns.length > 0) {
            const avgPatternConfidence = analysis.patterns.reduce((sum, p) => sum + p.confidence, 0) / analysis.patterns.length;
            totalConfidence += avgPatternConfidence * 0.3;
            factors += 0.3;
        }
        
        // قوة الزخم
        if (analysis.momentum && analysis.momentum.strength) {
            totalConfidence += analysis.momentum.strength * 0.25;
            factors += 0.25;
        }
        
        // وضوح الدورات
        if (analysis.cycles) {
            const cycleClarity = this.assessCycleClarity(analysis.cycles);
            totalConfidence += cycleClarity * 0.2;
            factors += 0.2;
        }
        
        // اتساق السيناريوهات
        if (analysis.scenarios && analysis.scenarios.length > 0) {
            const scenarioConsistency = analysis.scenarios[0].probability;
            totalConfidence += scenarioConsistency * 0.25;
            factors += 0.25;
        }
        
        return factors > 0 ? Math.round(totalConfidence / factors) : 50;
    }

    determinePrimaryTrend(analysis) {
        const votes = { bullish: 0, bearish: 0, neutral: 0 };
        
        // تصويت الأنماط
        analysis.patterns?.forEach(pattern => {
            const weight = pattern.confidence / 100;
            if (pattern.direction === 'bullish') votes.bullish += weight;
            else if (pattern.direction === 'bearish') votes.bearish += weight;
            else votes.neutral += weight;
        });
        
        // تصويت الزخم
        if (analysis.momentum?.trend?.direction === 'صاعد') votes.bullish += 1;
        else if (analysis.momentum?.trend?.direction === 'هابط') votes.bearish += 1;
        
        // تحديد الاتجاه الأساسي
        const maxVotes = Math.max(votes.bullish, votes.bearish, votes.neutral);
        if (maxVotes === votes.bullish) return 'صاعد';
        if (maxVotes === votes.bearish) return 'هابط';
        return 'جانبي';
    }

    assessCycleClarity(cycles) {
        let clarity = 0;
        let count = 0;
        
        Object.values(cycles).forEach(cycleGroup => {
            if (Array.isArray(cycleGroup)) {
                cycleGroup.forEach(cycle => {
                    if (cycle.confidence || cycle.strength) {
                        clarity += parseFloat(cycle.confidence || cycle.strength);
                        count++;
                    }
                });
            }
        });
        
        return count > 0 ? clarity / count : 50;
    }

    createSummaryReport(analysis) {
        return {
            summary: {
                timestamp: analysis.timestamp,
                primaryTrend: analysis.primaryTrend,
                confidence: analysis.overallConfidence,
                currentPrice: analysis.currentPrice
            },
            
            keyPatterns: analysis.patterns?.slice(0, 3) || [],
            
            topOpportunities: analysis.opportunities?.slice(0, 2) || [],
            
            mainScenario: analysis.scenarios?.[0] || null,
            
            riskLevel: analysis.riskAnalysis?.overallRisk || 'متوسط',
            
            nextTargets: {
                upside: analysis.targets?.immediate?.filter(t => parseFloat(t.price) > analysis.currentPrice)?.[0] || null,
                downside: analysis.targets?.immediate?.filter(t => parseFloat(t.price) < analysis.currentPrice)?.[0] || null
            },
            
            keyLevels: {
                support: analysis.dynamicLevels?.support?.[0] || null,
                resistance: analysis.dynamicLevels?.resistance?.[0] || null
            },
            
            recommendations: analysis.riskAnalysis?.recommendations?.slice(0, 3) || []
        };
    }
}

// تصدير الكلاس للاستخدام
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElliottWaveRadar;
} else if (typeof window !== 'undefined') {
    window.ElliottWaveRadar = ElliottWaveRadar;
}


// مثال على الاستخدام
/*
const analyzer =new ElliottWaveRadar();
;
d();

// بيانات الأسعار (مثال)
const priceData = [100, 105, 103, 108, 106, 112, 110, 115, 113, 118, 116, 120];

// خيارات التحليل
const options = {
    fullReport: true,
    portfolioSize: 100000,
    includeCalculations: true,
    volumeData: [1000, 1200, 800, 1500, 900, 1800, 1100, 2000, 1300, 2200, 1400, 2500],
    marketConditions: {
        volatility: 'متوسط',
        trend: 'صاعد',
        volume: 'متزايد'
    }
};

// تشغيل التحليل
analyzer.analyzeAdvanced(priceData, options)
    .then(result => {
        console.log('نتائج التحليل:', result);
    })
    .catch(error => {
        console.error('خطأ:', error);
    });
*/

console.log('✅ تم تحميل Elliott Wave Radar Enhanced بنجاح');
console.log('📊 جاهز لتحليل الأسواق المالية باستخدام نظرية موجات إليوت المتقدمة');

