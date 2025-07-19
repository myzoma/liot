class ElliottWaveImageGenerator {
    constructor(config = {}) {
        this.config = {
            width: config.width || 800,
            height: config.height || 600,
            backgroundColor: config.backgroundColor || '#1a1a2e',
            primaryColor: config.primaryColor || '#00d4aa',
            secondaryColor: config.secondaryColor || '#ff6b6b',
            textColor: config.textColor || '#ffffff',
            gridColor: config.gridColor || '#333333',
            font: config.font || 'Arial',
            ...config
        };
    }

    // إنشاء صورة التوصية الرئيسية
    async generateRecommendationImage(analysis) {
        const canvas = document.createElement('canvas');
        canvas.width = this.config.width;
        canvas.height = this.config.height;
        const ctx = canvas.getContext('2d');

        // خلفية متدرجة
        this.drawGradientBackground(ctx);
        
        // رسم الشبكة
        this.drawGrid(ctx);
        
        // رسم العنوان
        this.drawTitle(ctx, 'تحليل Elliott Wave');
        
        // رسم معلومات السوق
        this.drawMarketInfo(ctx, analysis);
        
        // رسم التوصيات
        this.drawRecommendations(ctx, analysis.recommendations);
        
        // رسم مستويات الدعم والمقاومة
        this.drawSupportResistanceLevels(ctx, analysis.dynamicLevels, analysis.currentPrice);
        
        // رسم معلومات النمط
        this.drawPatternInfo(ctx, analysis.patterns[0]);
        
        // رسم التوقيت والتوقيع
        this.drawFooter(ctx);

        return canvas.toDataURL('image/png');
    }

    // رسم الخلفية المتدرجة
    drawGradientBackground(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.config.height);
        gradient.addColorStop(0, this.config.backgroundColor);
        gradient.addColorStop(1, '#16213e');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.config.width, this.config.height);
    }

    // رسم الشبكة
    drawGrid(ctx) {
        ctx.strokeStyle = this.config.gridColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;

        // خطوط عمودية
        for (let x = 0; x <= this.config.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.config.height);
            ctx.stroke();
        }

        // خطوط أفقية
        for (let y = 0; y <= this.config.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.config.width, y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    // رسم العنوان
    drawTitle(ctx, title) {
        ctx.fillStyle = this.config.primaryColor;
        ctx.font = `bold 32px ${this.config.font}`;
        ctx.textAlign = 'center';
        ctx.fillText(title, this.config.width / 2, 50);
        
        // خط تحت العنوان
        ctx.strokeStyle = this.config.primaryColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.config.width / 2 - 150, 65);
        ctx.lineTo(this.config.width / 2 + 150, 65);
        ctx.stroke();
    }

    // رسم معلومات السوق
    drawMarketInfo(ctx, analysis) {
        const startY = 100;
        ctx.fillStyle = this.config.textColor;
        ctx.font = `18px ${this.config.font}`;
        ctx.textAlign = 'right';

        // معلومات أساسية
        const info = [
            `السعر الحالي: ${analysis.currentPrice?.toFixed(4) || 'غير متوفر'}`,
            `الاتجاه العام: ${this.translateTrend(analysis.trend)}`,
            `عدد الأنماط: ${analysis.patterns?.length || 0}`,
            `مستوى الثقة: ${analysis.patterns?.[0]?.confidence?.toFixed(1) || 0}%`
        ];

        info.forEach((text, index) => {
            ctx.fillText(text, this.config.width - 30, startY + (index * 30));
        });
    }

    // رسم التوصيات
    drawRecommendations(ctx, recommendations) {
        if (!recommendations || recommendations.length === 0) return;

        const startY = 250;
        const boxWidth = 350;
        const boxHeight = 200;
        const x = 30;

        // رسم صندوق التوصية
        this.drawRoundedRect(ctx, x, startY, boxWidth, boxHeight, 15, this.config.primaryColor, 0.1);
        
        // عنوان التوصية
        ctx.fillStyle = this.config.primaryColor;
        ctx.font = `bold 24px ${this.config.font}`;
        ctx.textAlign = 'right';
        ctx.fillText('التوصية', x + boxWidth - 20, startY + 35);

        const mainRec = recommendations[0];
        let yOffset = 70;

        // نوع التوصية
        const typeColor = this.getRecommendationColor(mainRec.type);
        ctx.fillStyle = typeColor;
        ctx.font = `bold 20px ${this.config.font}`;
        ctx.fillText(this.translateRecommendationType(mainRec.type), x + boxWidth - 20, startY + yOffset);
        yOffset += 35;

        // رسالة التوصية
        ctx.fillStyle = this.config.textColor;
        ctx.font = `16px ${this.config.font}`;
        this.wrapText(ctx, mainRec.message, x + 20, startY + yOffset, boxWidth - 40, 20);
        yOffset += 60;

        // معلومات إضافية
        if (mainRec.entry) {
            ctx.fillText(`نقطة الدخول: ${mainRec.entry.toFixed(4)}`, x + boxWidth - 20, startY + yOffset);
            yOffset += 25;
        }

        if (mainRec.stopLoss) {
            ctx.fillStyle = this.config.secondaryColor;
            ctx.fillText(`وقف الخسارة: ${mainRec.stopLoss.toFixed(4)}`, x + boxWidth - 20, startY + yOffset);
        }
    }

    // رسم مستويات الدعم والمقاومة
    drawSupportResistanceLevels(ctx, levels, currentPrice) {
        if (!levels || !currentPrice) return;

        const chartX = 420;
        const chartY = 250;
        const chartWidth = 350;
        const chartHeight = 200;

        // رسم صندوق الرسم البياني
        this.drawRoundedRect(ctx, chartX, chartY, chartWidth, chartHeight, 15, this.config.secondaryColor, 0.1);

        // عنوان الرسم البياني
        ctx.fillStyle = this.config.secondaryColor;
        ctx.font = `bold 20px ${this.config.font}`;
        ctx.textAlign = 'right';
        ctx.fillText('مستويات الدعم والمقاومة', chartX + chartWidth - 20, chartY + 35);

        // حساب النطاق السعري
        const allLevels = [...(levels.support || []), ...(levels.resistance || []), currentPrice];
        const minPrice = Math.min(...allLevels);
        const maxPrice = Math.max(...allLevels);
        const priceRange = maxPrice - minPrice;

        // رسم السعر الحالي
        const currentY = chartY + chartHeight - 50 - ((currentPrice - minPrice) / priceRange) * (chartHeight - 100);
        ctx.strokeStyle = this.config.primaryColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(chartX + 20, currentY);
        ctx.lineTo(chartX + chartWidth - 20, currentY);
        ctx.stroke();
        ctx.setLineDash([]);

        // تسمية السعر الحالي
        ctx.fillStyle = this.config.primaryColor;
        ctx.font = `14px ${this.config.font}`;
        ctx.textAlign = 'left';
        ctx.fillText(`السعر: ${currentPrice.toFixed(4)}`, chartX + 25, currentY - 5);

        // رسم مستويات المقاومة
        if (levels.resistance) {
            ctx.strokeStyle = this.config.secondaryColor;
            ctx.lineWidth = 2;
            levels.resistance.slice(0, 3).forEach((level, index) => {
                const y = chartY + chartHeight - 50 - ((level - minPrice) / priceRange) * (chartHeight - 100);
                ctx.beginPath();
                ctx.moveTo(chartX + 20, y);
                ctx.lineTo(chartX + chartWidth - 20, y);
                ctx.stroke();
                
                ctx.fillStyle = this.config.secondaryColor;
                ctx.fillText(`مقاومة: ${level.toFixed(4)}`, chartX + 25, y - 5);
            });
        }

        // رسم مستويات الدعم
        if (levels.support) {
            ctx.strokeStyle = this.config.primaryColor;
            ctx.lineWidth = 2;
            levels.support.slice(0, 3).forEach((level, index) => {
                const y = chartY + chartHeight - 50 - ((level - minPrice) / priceRange) * (chartHeight - 100);
                ctx.beginPath();
                ctx.moveTo(chartX + 20, y);
                ctx.lineTo(chartX + chartWidth - 20, y);
                ctx.stroke();
                
                ctx.fillStyle = this.config.primaryColor;
                ctx.fillText(`دعم: ${level.toFixed(4)}`, chartX + 25, y + 15);
            });
        }
    }

    // رسم معلومات النمط
    drawPatternInfo(ctx, pattern) {
        if (!pattern) return;

        const startY = 480;
        const boxWidth = this.config.width - 60;
        const boxHeight = 80;
        const x = 30;

        // رسم صندوق معلومات النمط
        this.drawRoundedRect(ctx, x, startY, boxWidth, boxHeight, 10, this.config.primaryColor, 0.05);

        ctx.fillStyle = this.config.textColor;
        ctx.font = `16px ${this.config.font}`;
        ctx.textAlign = 'right';

        const patternInfo = [
            `نوع النمط: ${pattern.type === 'motive' ? 'دافع' : 'تصحيحي'}`,
            `الاتجاه: ${pattern.direction === 'bullish' ? 'صاعد' : 'هابط'}`,
            `مستوى الثقة: ${pattern.confidence.toFixed(1)}%`,
            `عدد النقاط: ${pattern.points.length}`
        ];

        patternInfo.forEach((info, index) => {
            const xPos = x + (boxWidth / 2) * (index % 2 === 0 ? 2 : 1) - 20;
            const yPos = startY + 30 + Math.floor(index / 2) * 25;
            ctx.fillText(info, xPos, yPos);
        });
    }

    // رسم التذييل
    drawFooter(ctx) {
        const footerY = this.config.height - 30;
        
        ctx.fillStyle = this.config.textColor;
        ctx.font = `12px ${this.config.font}`;
        ctx.globalAlpha = 0.7;
        
        // التوقيت
        ctx.textAlign = 'left';
        const now = new Date();
        const timeString = now.toLocaleString('ar-SA');
        ctx.fillText(`تم إنشاؤه في: ${timeString}`, 30, footerY);
        
        // التوقيع
        ctx.textAlign = 'right';
        ctx.fillText('Elliott Wave Analyzer - تحليل الموجات', this.config.width - 30, footerY);
        
        ctx.globalAlpha = 1;
    }

    // رسم مستطيل مدور
    drawRoundedRect(ctx, x, y, width, height, radius, color, alpha = 1) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // تقسيم النص على عدة أسطر
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x + maxWidth, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x + maxWidth, currentY);
    }

    // الحصول على لون التوصية
    getRecommendationColor(type) {
        const colors = {
            'buy': '#00ff88',
            'sell': '#ff4757',
            'wait': '#ffa502',
            'caution': '#ff6348',
            'neutral': '#747d8c'
        };
        return colors[type] || this.config.textColor;
    }

    // ترجمة نوع التوصية
    translateRecommendationType(type) {
        const translations = {
            'buy': 'شراء',
            'sell': 'بيع',
            'wait': 'انتظار',
            'caution': 'حذر',
            'neutral': 'محايد'
        };
        return translations[type] || type;
    }

    // ترجمة الاتجاه
    translateTrend(trend) {
        const translations = {
            'bullish': 'صاعد',
            'bearish': 'هابط',
            'neutral': 'محايد',
            'bullish_correction_end': 'نهاية تصحيح صاعد',
            'bearish_correction_end': 'نهاية تصحيح هابط'
        };
        return translations[trend] || trend;
    }

    // إنشاء صورة مفصلة للنمط
    async generatePatternDetailImage(pattern) {
        const canvas = document.createElement('canvas');
        canvas.width = this.config.width;
        canvas.height = this.config.height;
        const ctx = canvas.getContext('2d');

        // خلفية
        this.drawGradientBackground(ctx);
        
        // عنوان
        this.drawTitle(ctx, `تفاصيل النمط ${pattern.type === 'motive' ? 'الدافع' : 'التصحيحي'}`);
        
        // رسم الرسم البياني للنمط
        this.drawPatternChart(ctx, pattern);
        
        // رسم تفاصيل الموجات
        this.drawWaveDetails(ctx, pattern);
        
        // رسم نسب فيبوناتشي
        this.drawFibonacciAnalysis(ctx, pattern);
        
        // التذييل
        this.drawFooter(ctx);

        return canvas.toDataURL('image/png');
    }

    // رسم الرسم البياني للنمط
    drawPatternChart(ctx, pattern) {
        const chartX = 50;
        const chartY = 100;
        const chartWidth = 700;
        const chartHeight = 250;

        // رسم إطار الرسم البياني
        ctx.strokeStyle = this.config.gridColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(chartX, chartY, chartWidth, chartHeight);

        // حساب النطاق السعري
        const prices = pattern.points.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;

        // رسم النقاط والخطوط
        ctx.strokeStyle = this.config.primaryColor;
        ctx.lineWidth = 3;
        ctx.beginPath();

        pattern.points.forEach((point, index) => {
            const x = chartX + (index / (pattern.points.length - 1)) * chartWidth;
            const y = chartY + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            // رسم النقطة
            ctx.save();
            ctx.fillStyle = point.type === 'high' ? this.config.secondaryColor : this.config.primaryColor;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();

            // تسمية النقطة
            ctx.fillStyle = this.config.textColor;
            ctx.font = `12px ${this.config.font}`;
            ctx.textAlign = 'center';
            ctx.fillText(`${point.price.toFixed(4)}`, x, y - 15);
            
            // رقم الموجة
            ctx.fillStyle = this.config.primaryColor;
            ctx.font = `bold 14px ${this.config.font}`;
            ctx.fillText(index + 1, x, y + 25);
        });

        ctx.stroke();
    }

    // رسم تفاصيل الموجات
    drawWaveDetails(ctx, pattern) {
        const startY = 380;
        const boxWidth = 340;
        const boxHeight = 150;

        // صندوق تفاصيل الموجات
        this.drawRoundedRect(ctx, 50, startY, boxWidth, boxHeight, 10, this.config.primaryColor, 0.1);
        
        ctx.fillStyle = this.config.primaryColor;
        ctx.font = `bold 18px ${this.config.font}`;
        ctx.textAlign = 'right';
        ctx.fillText('تفاصيل الموجات', 50 + boxWidth - 20, startY + 30);

        ctx.fillStyle = this.config.textColor;
        ctx.font = `14px ${this.config.font}`;
        
        let yOffset = 55;
        Object.entries(pattern.waves).forEach(([waveKey, wave], index) => {
            const waveNum = waveKey.replace('w', '');
            const length = wave.length.toFixed(4);
            const percentage = wave.percentage.toFixed(2);
            
            ctx.fillText(`الموجة ${waveNum}: ${length} (${percentage}%)`, 50 + boxWidth - 20, startY + yOffset);
            yOffset += 20;
        });
    }

    // رسم تحليل فيبوناتشي
    drawFibonacciAnalysis(ctx, pattern) {
        const startY = 380;
        const boxWidth = 340;
        const boxHeight = 150;
        const boxX = 410;

        // صندوق تحليل فيبوناتشي
        this.drawRoundedRect(ctx, boxX, startY, boxWidth, boxHeight, 10, this.config.secondaryColor, 0.1);
        
        ctx.fillStyle = this.config.secondaryColor;
        ctx.font = `bold 18px ${this.config.font}`;
        ctx.textAlign = 'right';
        ctx.fillText('تحليل فيبوناتشي', boxX + boxWidth - 20, startY + 30);

        if (pattern.fibonacciAnalysis) {
            ctx.fillStyle = this.config.textColor;
            ctx.font = `14px ${this.config.font}`;
            
            let yOffset = 55;
            Object.entries(pattern.fibonacciAnalysis).forEach(([key, analysis]) => {
                if (analysis.fibLevel) {
                    const color = analysis.isValid ? this.config.primaryColor : this.config.secondaryColor;
                    ctx.fillStyle = color;
                    ctx.fillText(`${key}: ${(analysis.fibLevel * 100).toFixed(1)}%`, boxX + boxWidth - 20, startY + yOffset);
                    yOffset += 20;
                }
            });
        }
    }

    // إنشاء صورة ملخص سريع
    async generateQuickSummaryImage(analysis) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // خلفية مبسطة
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(1, '#34495e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 600, 400);

        // عنوان
        ctx.fillStyle = this.config.primaryColor;
        ctx.font = `bold 24px ${this.config.font}`;
        ctx.textAlign = 'center';
        ctx.fillText('ملخص Elliott Wave', 300, 40);

        // معلومات أساسية
        const info = [
            `السعر: ${analysis.currentPrice?.toFixed(4) || 'غير متوفر'}`,
            `الاتجاه: ${this.translateTrend(analysis.trend)}`,
            `الثقة: ${analysis.patterns?.[0]?.confidence?.toFixed(1) || 0}%`
        ];

        ctx.fillStyle = this.config.textColor;
        ctx.font = `18px ${this.config.font}`;
        ctx.textAlign = 'center';

        info.forEach((text, index) => {
            ctx.fillText(text, 300, 100 + (index * 30));
        });

        // التوصية الرئيسية
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            const rec = analysis.recommendations[0];
            const recColor = this.getRecommendationColor(rec.type);
            
            // صندوق التوصية
            this.drawRoundedRect(ctx, 100, 200, 400, 100, 15, recColor, 0.2);
            
            ctx.fillStyle = recColor;
            ctx.font = `bold 20px ${this.config.font}`;
            ctx.textAlign = 'center';
            ctx.fillText(this.translateRecommendationType(rec.type), 300, 230);
            
            ctx.fillStyle = this.config.textColor;
            ctx.font = `14px ${this.config.font}`;
            this.wrapText(ctx, rec.message, 120, 250, 360, 18);
        }

        // التوقيت
        ctx.fillStyle = this.config.textColor;
        ctx.font = `12px ${this.config.font}`;
        ctx.globalAlpha = 0.7;
        ctx.textAlign = 'center';
        const now = new Date();
        ctx.fillText(now.toLocaleString('ar-SA'), 300, 380);
        ctx.globalAlpha = 1;

        return canvas.toDataURL('image/png');
    }

    // حفظ الصورة
    async saveImage(imageDataUrl, filename = 'elliott-wave-analysis.png') {
        if (typeof window !== 'undefined') {
            // في المتصفح
            const link = document.createElement('a');
            link.download = filename;
            link.href = imageDataUrl;
            link.click();
        } else {
            // في Node.js
            const fs = require('fs');
            const base64Data = imageDataUrl.replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync(filename, base64Data, 'base64');
        }
    }

    // إنشاء مجموعة كاملة من الصور
    async generateCompleteImageSet(analysis) {
        const images = {};

        try {
            // الصورة الرئيسية
            images.main = await this.generateRecommendationImage(analysis);
            
            // ملخص سريع
            images.summary = await this.generateQuickSummaryImage(analysis);
            
            // تفاصيل النمط (إذا وُجد)
            if (analysis.patterns && analysis.patterns.length > 0) {
                images.patternDetail = await this.generatePatternDetailImage(analysis.patterns[0]);
            }

            return images;
        } catch (error) {
            console.error('خطأ في إنشاء الصور:', error);
            return null;
        }
    }
}

// تحديث كلاس ElliottWaveAnalyzer لإضافة إنشاء الصور
class ElliottWaveAnalyzer {
    constructor(config = {}) {
        // الكود الأصلي...
        this.config = {
            len1: config.len1 || 4,
            len2: config.len2 || 8,
            len3: config.len3 || 16,
            minWaveLength: config.minWaveLength || 0.5,
            maxWaveLength: config.maxWaveLength || 5.0,
            fib236: 0.236,
            fib382: 0.382,
            fib500: 0.500,
            fib618: 0.618,
            fib764: 0.764,
            fib854: 0.854,
            fib1000: 1.000,
            fib1272: 1.272,
            fib1618: 1.618,
            fib2618: 2.618
        };

        // إضافة مولد الصور
        this.imageGenerator = new ElliottWaveImageGenerator(config.imageConfig);
        
        // باقي الكود الأصلي...
        this.elliottRules = {
            motive: {
                wave2CannotExceedWave1Start: true,
                wave3NotShortest: true,
                wave4CannotOverlapWave1: true,
                impulsiveWavesSameDirection: true
            },
            corrective: {
                waveCRelationToA: true,
                waveBMaxRetracement: true
            }
        };
    }

    // إضافة دالة لتحليل وإنشاء الصور
    async analyzeWithImages(klineData) {
        // تشغيل التحليل العادي
        const analysis = this.analyze(klineData);
        
        if (analysis.status === 'success') {
            // إنشاء الصور
            const images = await this.imageGenerator.generateCompleteImageSet(analysis);
            analysis.images = images;
        }
        
        return analysis;
    }

    // باقي الدوال الأصلية...
    findPivots(data, leftBars = 4, rightBars = 4) {
        const pivots = [];
        
        for (let i = leftBars; i < data.length - rightBars; i++) {
            const current = data[i];
            let isHigh = true;
            let isLow = true;
            
            for (let j = i - leftBars; j <= i + rightBars; j++) {
                if (j !== i && data[j].high >= current.high) {
                    isHigh = false;
                    break;
                }
            }
            
            for (let j = i - leftBars; j <= i + rightBars; j++) {
                if (j !== i && data[j].low <= current.low) {
                    isLow = false;
                    break;
                }
            }
            
            if (isHigh) {
                pivots.push({
                    index: i,
                    type: 'high',
                    price: current.high,
                    time: current.time
                });
            }
            
            if (isLow) {
                pivots.push({
                    index: i,
                    type: 'low',
                    price: current.low,
                    time: current.time
                });
            }
        }
        
        return pivots.sort((a, b) => a.index - b.index);
    }

    // تحليل الموجات الدافعة (Impulse Waves)
    analyzeImpulseWave(pivots) {
        if (pivots.length < 6) return null;
        
        const patterns = [];
        
        for (let i = 0; i <= pivots.length - 6; i++) {
            const wave = pivots.slice(i, i + 6);
            
            if (this.validateImpulsePattern(wave)) {
                const analysis = this.calculateWaveMetrics(wave);
                const fibAnalysis = this.analyzeFibonacciRelationships(wave);
                
                patterns.push({
                    type: 'motive',
                    subtype: 'impulse',
                    points: wave,
                    waves: analysis.waves,
                    fibonacciAnalysis: fibAnalysis,
                    confidence: this.calculatePatternConfidence(wave, analysis, fibAnalysis),
                    projection: this.calculateWaveProjection(wave)
                });
            }
        }
        
        return patterns.length > 0 ? patterns : null;
    }

    // تحليل الموجات التصحيحية (Corrective Waves)
    analyzeCorrectiveWave(pivots) {
        if (pivots.length < 4) return null;
        
        const patterns = [];
        
        // تحليل ABC
        for (let i = 0; i <= pivots.length - 4; i++) {
            const wave = pivots.slice(i, i + 4);
            
            if (this.validateCorrectivePattern(wave)) {
                const analysis = this.calculateCorrectiveMetrics(wave);
                const fibAnalysis = this.analyzeCorrectiveFibonacci(wave);
                
                patterns.push({
                    type: 'corrective',
                    subtype: 'abc',
                    points: wave,
                    waves: analysis.waves,
                    fibonacciAnalysis: fibAnalysis,
                    confidence: this.calculateCorrectiveConfidence(wave, analysis, fibAnalysis),
                    projection: this.calculateCorrectiveProjection(wave)
                });
            }
        }
        
        return patterns.length > 0 ? patterns : null;
    }

    // التحقق من صحة النمط الدافع
    validateImpulsePattern(wave) {
        if (wave.length !== 6) return false;
        
        // القاعدة 1: الموجة 2 لا يمكن أن تتجاوز بداية الموجة 1
        const wave1Start = wave[0].price;
        const wave2End = wave[2].price;
        
        if (wave[0].type === 'low') {
            if (wave2End <= wave1Start) return false;
        } else {
            if (wave2End >= wave1Start) return false;
        }
        
        // القاعدة 2: الموجة 3 ليست الأقصر
        const wave1Length = Math.abs(wave[1].price - wave[0].price);
        const wave3Length = Math.abs(wave[3].price - wave[2].price);
        const wave5Length = Math.abs(wave[5].price - wave[4].price);
        
        if (wave3Length < wave1Length && wave3Length < wave5Length) return false;
        
        // القاعدة 3: الموجة 4 لا تتداخل مع الموجة 1
        const wave1End = wave[1].price;
        const wave4End = wave[4].price;
        
        if (wave[0].type === 'low') {
            if (wave4End <= wave1End) return false;
        } else {
            if (wave4End >= wave1End) return false;
        }
        
        return true;
    }

    // التحقق من صحة النمط التصحيحي
    validateCorrectivePattern(wave) {
        if (wave.length !== 4) return false;
        
        // التحقق من أن الموجة B لا تتجاوز 100% من الموجة A
        const waveALength = Math.abs(wave[1].price - wave[0].price);
        const waveBLength = Math.abs(wave[2].price - wave[1].price);
        
        if (waveBLength > waveALength * 1.382) return false;
        
        return true;
    }

    // حساب مقاييس الموجات
    calculateWaveMetrics(wave) {
        const waves = {};
        
        for (let i = 0; i < wave.length - 1; i++) {
            const waveNum = i + 1;
            const length = Math.abs(wave[i + 1].price - wave[i].price);
            const direction = wave[i + 1].price > wave[i].price ? 'up' : 'down';
            
            waves[`w${waveNum}`] = {
                start: wave[i],
                end: wave[i + 1],
                length: length,
                direction: direction,
                percentage: 0 // سيتم حسابه لاحقاً
            };
        }
        
        // حساب النسب المئوية
        const totalLength = Object.values(waves).reduce((sum, w) => sum + w.length, 0);
        Object.keys(waves).forEach(key => {
            waves[key].percentage = (waves[key].length / totalLength) * 100;
        });
        
        return { waves };
    }

    // تحليل علاقات فيبوناتشي
    analyzeFibonacciRelationships(wave) {
        const analysis = {};
        
        if (wave.length >= 6) {
            // تحليل الموجة الدافعة
            const wave1 = Math.abs(wave[1].price - wave[0].price);
            const wave2 = Math.abs(wave[2].price - wave[1].price);
            const wave3 = Math.abs(wave[3].price - wave[2].price);
            const wave4 = Math.abs(wave[4].price - wave[3].price);
            const wave5 = Math.abs(wave[5].price - wave[4].price);
            
            // تحليل الموجة 2
            const wave2Ratio = wave2 / wave1;
            analysis.wave2 = {
                ratio: wave2Ratio,
                fibLevel: this.findClosestFibLevel(wave2Ratio),
                isValid: this.isValidFibRetracement(wave2Ratio)
            };
            
            // تحليل الموجة 3
            const wave3Ratio = wave3 / wave1;
            analysis.wave3 = {
                ratio: wave3Ratio,
                fibLevel: this.findClosestFibExtension(wave3Ratio),
                isValid: wave3Ratio >= 1.0 // الموجة 3 يجب أن تكون أطول من الموجة 1
            };
            
            // تحليل الموجة 4
            const wave4Ratio = wave4 / wave3;
            analysis.wave4 = {
                ratio: wave4Ratio,
                fibLevel: this.findClosestFibLevel(wave4Ratio),
                isValid: this.isValidFibRetracement(wave4Ratio)
            };
            
            // تحليل الموجة 5
            const wave5Ratio = wave5 / wave1;
            analysis.wave5 = {
                ratio: wave5Ratio,
                fibLevel: this.findClosestFibExtension(wave5Ratio),
                isValid: wave5Ratio >= 0.618
            };
        }
        
        return analysis;
    }

    // العثور على أقرب مستوى فيبوناتشي للتراجع
    findClosestFibLevel(ratio) {
        const fibLevels = [0.236, 0.382, 0.500, 0.618, 0.764];
        let closest = fibLevels[0];
        let minDiff = Math.abs(ratio - closest);
        
        for (const level of fibLevels) {
            const diff = Math.abs(ratio - level);
            if (diff < minDiff) {
                minDiff = diff;
                closest = level;
            }
        }
        
        return closest;
    }

    // العثور على أقرب مستوى فيبوناتشي للامتداد
    findClosestFibExtension(ratio) {
        const fibLevels = [1.000, 1.272, 1.618, 2.618];
        let closest = fibLevels[0];
        let minDiff = Math.abs(ratio - closest);
        
        for (const level of fibLevels) {
            const diff = Math.abs(ratio - level);
            if (diff < minDiff) {
                minDiff = diff;
                closest = level;
            }
        }
        
        return closest;
    }

    // التحقق من صحة تراجع فيبوناتشي
    isValidFibRetracement(ratio) {
        const validRanges = [
            [0.200, 0.270], // 23.6%
            [0.350, 0.420], // 38.2%
            [0.450, 0.550], // 50%
            [0.580, 0.650], // 61.8%
            [0.720, 0.800]  // 76.4%
        ];
        
        return validRanges.some(([min, max]) => ratio >= min && ratio <= max);
    }

    // حساب ثقة النمط
    calculatePatternConfidence(wave, analysis, fibAnalysis) {
        let confidence = 50; // نقطة البداية
        
        // إضافة نقاط للقواعد الأساسية
        if (this.validateImpulsePattern(wave)) {
            confidence += 20;
        }
        
        // إضافة نقاط لعلاقات فيبوناتشي الصحيحة
        Object.values(fibAnalysis).forEach(fib => {
            if (fib.isValid) {
                confidence += 5;
            }
        });
        
        // تقليل النقاط للانحرافات
        const wave3Length = analysis.waves.w3?.length || 0;
        const wave1Length = analysis.waves.w1?.length || 1;
        const wave5Length = analysis.waves.w5?.length || 0;
        
        // الموجة 3 يجب أن تكون الأطول أو الثانية في الطول
        if (wave3Length < wave1Length && wave3Length < wave5Length) {
            confidence -= 15;
        }
        
        return Math.max(0, Math.min(100, confidence));
    }

    // حساب إسقاط الموجة
    calculateWaveProjection(wave) {
        if (wave.length < 5) return null;
        
        const lastPoint = wave[wave.length - 1];
        const wave1Length = Math.abs(wave[1].price - wave[0].price);
        const direction = wave[0].type === 'low' ? 1 : -1;
        
        // إسقاطات محتملة للموجة 5
        const projections = {
            fib618: lastPoint.price + (direction * wave1Length * 0.618),
            fib1000: lastPoint.price + (direction * wave1Length * 1.000),
            fib1618: lastPoint.price + (direction * wave1Length * 1.618)
        };
        
        return projections;
    }

    // التحليل الرئيسي
    analyze(klineData) {
        try {
            if (!klineData || klineData.length < 20) {
                return {
                    status: 'error',
                    message: 'بيانات غير كافية للتحليل',
                    data: null
                };
            }

            // العثور على النقاط المحورية
            const pivots = this.findPivots(klineData);
            
            if (pivots.length < 4) {
                return {
                    status: 'error',
                    message: 'نقاط محورية غير كافية',
                    data: null
                };
            }

            // تحليل الأنماط
            const impulsePatterns = this.analyzeImpulseWave(pivots);
            const correctivePatterns = this.analyzeCorrectiveWave(pivots);
            
            // دمج جميع الأنماط
            const allPatterns = [];
            if (impulsePatterns) allPatterns.push(...impulsePatterns);
            if (correctivePatterns) allPatterns.push(...correctivePatterns);
            
            // ترتيب حسب الثقة
            allPatterns.sort((a, b) => b.confidence - a.confidence);
            
            // تحديد الاتجاه العام
            const trend = this.determineTrend(klineData, allPatterns);
            
            // إنشاء التوصيات
            const recommendations = this.generateRecommendations(allPatterns, trend, klineData);
            
            return {
                status: 'success',
                timestamp: new Date().toISOString(),
                currentPrice: klineData[klineData.length - 1].close,
                trend: trend,
                patterns: allPatterns.slice(0, 3), // أفضل 3 أنماط
                recommendations: recommendations,
                pivots: pivots,
                summary: this.generateSummary(allPatterns, trend, recommendations)
            };

        } catch (error) {
            return {
                status: 'error',
                message: `خطأ في التحليل: ${error.message}`,
                data: null
            };
        }
    }

    // تحديد الاتجاه العام
    determineTrend(klineData, patterns) {
        const recentData = klineData.slice(-20);
        const currentPrice = klineData[klineData.length - 1].close;
        const pastPrice = klineData[klineData.length - 20].close;
        
        let trend = 'neutral';
        
        if (currentPrice > pastPrice * 1.02) {
            trend = 'bullish';
        } else if (currentPrice < pastPrice * 0.98) {
            trend = 'bearish';
        }
        
        // تعديل الاتجاه بناءً على الأنماط
        if (patterns.length > 0) {
            const bestPattern = patterns[0];
            if (bestPattern.type === 'corrective' && bestPattern.confidence > 70) {
                trend = trend === 'bullish' ?
            fib1272: startPoint + (direction * waveA * 1.272),
            fib1618: startPoint + (direction * waveA * 1.618)
        };
        
        return projections;
    }

    // دالة مساعدة لتحويل البيانات
    formatKlineData(rawData) {
        return rawData.map(item => ({
            time: item.time || item.timestamp || Date.now(),
            open: parseFloat(item.open || item.o),
            high: parseFloat(item.high || item.h),
            low: parseFloat(item.low || item.l),
            close: parseFloat(item.close || item.c),
            volume: parseFloat(item.volume || item.v || 0)
        }));
    }

    // تحليل متقدم للأنماط المعقدة
    analyzeComplexPatterns(pivots) {
        const complexPatterns = [];
        
        // تحليل الموجات المثلثية (Triangle)
        const trianglePatterns = this.analyzeTrianglePattern(pivots);
        if (trianglePatterns) complexPatterns.push(...trianglePatterns);
        
        // تحليل الموجات المسطحة (Flat)
        const flatPatterns = this.analyzeFlatPattern(pivots);
        if (flatPatterns) complexPatterns.push(...flatPatterns);
        
        // تحليل الموجات الزجزاجية (Zigzag)
        const zigzagPatterns = this.analyzeZigzagPattern(pivots);
        if (zigzagPatterns) complexPatterns.push(...zigzagPatterns);
        
        return complexPatterns.length > 0 ? complexPatterns : null;
    }

    // تحليل النمط المثلثي
    analyzeTrianglePattern(pivots) {
        if (pivots.length < 6) return null;
        
        const patterns = [];
        
        for (let i = 0; i <= pivots.length - 6; i++) {
            const wave = pivots.slice(i, i + 6);
            
            if (this.validateTrianglePattern(wave)) {
                patterns.push({
                    type: 'corrective',
                    subtype: 'triangle',
                    points: wave,
                    confidence: this.calculateTriangleConfidence(wave),
                    projection: this.calculateTriangleProjection(wave)
                });
            }
        }
        
        return patterns.length > 0 ? patterns : null;
    }

    // التحقق من صحة النمط المثلثي
    validateTrianglePattern(wave) {
        // التحقق من تناقص الحجم في كل موجة
        for (let i = 0; i < wave.length - 2; i += 2) {
            const currentWave = Math.abs(wave[i + 1].price - wave[i].price);
            const nextWave = Math.abs(wave[i + 3].price - wave[i + 2].price);
            
            if (nextWave >= currentWave) return false;
        }
        
        return true;
    }

    // حساب ثقة النمط المثلثي
    calculateTriangleConfidence(wave) {
        let confidence = 55;
        
        // التحقق من تناقص الحجم
        let decreasingVolume = true;
        for (let i = 0; i < wave.length - 2; i += 2) {
            const currentWave = Math.abs(wave[i + 1].price - wave[i].price);
            const nextWave = Math.abs(wave[i + 3].price - wave[i + 2].price);
            
            if (nextWave < currentWave * 0.8) {
                confidence += 8;
            }
        }
        
        return Math.min(100, confidence);
    }

    // حساب إسقاط النمط المثلثي
    calculateTriangleProjection(wave) {
        const lastPoint = wave[wave.length - 1];
        const triangleHeight = this.calculateTriangleHeight(wave);
        
        return {
            breakout_up: lastPoint.price + triangleHeight,
            breakout_down: lastPoint.price - triangleHeight
        };
    }

    // حساب ارتفاع المثلث
    calculateTriangleHeight(wave) {
        const highs = wave.filter(p => p.type === 'high').map(p => p.price);
        const lows = wave.filter(p => p.type === 'low').map(p => p.price);
        
        const maxHigh = Math.max(...highs);
        const minLow = Math.min(...lows);
        
        return maxHigh - minLow;
    }

    // تحليل النمط المسطح
    analyzeFlatPattern(pivots) {
        if (pivots.length < 4) return null;
        
        const patterns = [];
        
        for (let i = 0; i <= pivots.length - 4; i++) {
            const wave = pivots.slice(i, i + 4);
            
            if (this.validateFlatPattern(wave)) {
                patterns.push({
                    type: 'corrective',
                    subtype: 'flat',
                    points: wave,
                    confidence: this.calculateFlatConfidence(wave),
                    projection: this.calculateFlatProjection(wave)
                });
            }
        }
        
        return patterns.length > 0 ? patterns : null;
    }

    // التحقق من صحة النمط المسطح
    validateFlatPattern(wave) {
        const waveA = Math.abs(wave[1].price - wave[0].price);
        const waveB = Math.abs(wave[2].price - wave[1].price);
        const waveC = Math.abs(wave[3].price - wave[2].price);
        
        // في النمط المسطح، الموجة B تكون عادة 90% أو أكثر من A
        const bToARatio = waveB / waveA;
        if (bToARatio < 0.90) return false;
        
        // الموجة C تكون مساوية تقريباً للموجة A
        const cToARatio = waveC / waveA;
        if (cToARatio < 0.90 || cToARatio > 1.10) return false;
        
        return true;
    }

    // حساب ثقة النمط المسطح
    calculateFlatConfidence(wave) {
        let confidence = 65;
        
        const waveA = Math.abs(wave[1].price - wave[0].price);
        const waveB = Math.abs(wave[2].price - wave[1].price);
        const waveC = Math.abs(wave[3].price - wave[2].price);
        
        const bToARatio = waveB / waveA;
        const cToARatio = waveC / waveA;
        
        // إضافة نقاط للنسب الصحيحة
        if (bToARatio >= 0.95 && bToARatio <= 1.05) confidence += 10;
        if (cToARatio >= 0.95 && cToARatio <= 1.05) confidence += 10;
        
        return Math.min(100, confidence);
    }

    // حساب إسقاط النمط المسطح
    calculateFlatProjection(wave) {
        const waveA = Math.abs(wave[1].price - wave[0].price);
        const direction = wave[3].price > wave[2].price ? 1 : -1;
        const startPoint = wave[2].price;
        
        return {
            target: startPoint + (direction * waveA)
        };
    }

    // تحليل النمط الزجزاجي
    analyzeZigzagPattern(pivots) {
        if (pivots.length < 4) return null;
        
        const patterns = [];
        
        for (let i = 0; i <= pivots.length - 4; i++) {
            const wave = pivots.slice(i, i + 4);
            
            if (this.validateZigzagPattern(wave)) {
                patterns.push({
                    type: 'corrective',
                    subtype: 'zigzag',
                    points: wave,
                    confidence: this.calculateZigzagConfidence(wave),
                    projection: this.calculateZigzagProjection(wave)
                });
            }
        }
        
        return patterns.length > 0 ? patterns : null;
    }

    // التحقق من صحة النمط الزجزاجي
    validateZigzagPattern(wave) {
        const waveA = Math.abs(wave[1].price - wave[0].price);
        const waveB = Math.abs(wave[2].price - wave[1].price);
        const waveC = Math.abs(wave[3].price - wave[2].price);
        
        // في النمط الزجزاجي، الموجة B عادة 38.2% إلى 78.6% من A
        const bToARatio = waveB / waveA;
        if (bToARatio < 0.382 || bToARatio > 0.786) return false;
        
        // الموجة C عادة 100% إلى 161.8% من A
        const cToARatio = waveC / waveA;
        if (cToARatio < 1.00 || cToARatio > 1.618) return false;
        
        return true;
    }

    // حساب ثقة النمط الزجزاجي
    calculateZigzagConfidence(wave) {
        let confidence = 70;
        
        const waveA = Math.abs(wave[1].price - wave[0].price);
        const waveB = Math.abs(wave[2].price - wave[1].price);
        const waveC = Math.abs(wave[3].price - wave[2].price);
        
        const bToARatio = waveB / waveA;
        const cToARatio = waveC / waveA;
        
        // إضافة نقاط للنسب المثالية
        if (bToARatio >= 0.50 && bToARatio <= 0.618) confidence += 8;
        if (cToARatio >= 1.00 && cToARatio <= 1.272) confidence += 8;
        
        return Math.min(100, confidence);
    }

    // حساب إسقاط النمط الزجزاجي
    calculateZigzagProjection(wave) {
        const waveA = Math.abs(wave[1].price - wave[0].price);
        const direction = wave[3].price > wave[2].price ? 1 : -1;
        const startPoint = wave[2].price;
        
        return {
            fib1000: startPoint + (direction * waveA * 1.000),
            fib1272: startPoint + (direction * waveA * 1.272),
            fib1618: startPoint + (direction * waveA * 1.618)
        };
    }

    // تحليل شامل محسن
    analyzeEnhanced(klineData) {
        try {
            const basicAnalysis = this.analyze(klineData);
            
            if (basicAnalysis.status !== 'success') {
                return basicAnalysis;
            }
            
            // إضافة تحليل الأنماط المعقدة
            const pivots = this.findPivots(klineData);
            const complexPatterns = this.analyzeComplexPatterns(pivots);
            
            if (complexPatterns) {
                basicAnalysis.patterns.push(...complexPatterns);
                basicAnalysis.patterns.sort((a, b) => b.confidence - a.confidence);
                basicAnalysis.patterns = basicAnalysis.patterns.slice(0, 5); // أفضل 5 أنماط
            }
            
            // تحديث التوصيات بناءً على الأنماط الجديدة
            basicAnalysis.recommendations = this.generateRecommendations(
                basicAnalysis.patterns, 
                basicAnalysis.trend, 
                klineData
            );
            
            // تحديث الملخص
            basicAnalysis.summary = this.generateSummary(
                basicAnalysis.patterns,
                basicAnalysis.trend,
                basicAnalysis.recommendations
            );
            
            return basicAnalysis;
            
        } catch (error) {
            return {
                status: 'error',
                message: `خطأ في التحليل المحسن: ${error.message}`,
                data: null
            };
        }
    }
}

// دالة مساعدة لاستخدام المحلل
function createElliottWaveAnalyzer(config = {}) {
    return new ElliottWaveAnalyzer(config);
}

// تصدير الكلاسات والدوال
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        ElliottWaveAnalyzer,
        ElliottWaveImageGenerator,
        createElliottWaveAnalyzer
    };
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.ElliottWaveAnalyzer = ElliottWaveAnalyzer;
    window.ElliottWaveImageGenerator = ElliottWaveImageGenerator;
    window.createElliottWaveAnalyzer = createElliottWaveAnalyzer;
}

// مثال على الاستخدام
/*
const analyzer = createElliottWaveAnalyzer({
    len1: 4,
    len2: 8,
    len3: 16,
    imageConfig: {
        width: 800,
        height: 600,
        primaryColor: '#00d4aa',
        secondaryColor: '#ff6b6b'
    }
});

// تحليل البيانات مع إنشاء الصور
analyzer.analyzeWithImages(klineData).then(result => {
    if (result.status === 'success') {
        console.log('التحليل:', result);
        
        // حفظ الصور
        if (result.images) {
            analyzer.imageGenerator.saveImage(result.images.main, 'elliott-main.png');
            analyzer.imageGenerator.saveImage(result.images.summary, 'elliott-summary.png');
            
            if (result.images.patternDetail) {
                analyzer.imageGenerator.saveImage(result.images.patternDetail, 'elliott-pattern.png');
            }
        }
    }
});

// أو التحليل العادي بدون صور
const result = analyzer.analyzeEnhanced(klineData);
console.log('نتيجة التحليل:', result);
*/
