using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace YanUrunler.Sunucu;

/*  RaporPdf — tarayıcıdan gelen HAZIR TABLOYU kâğıda dizer.

    SUNUCU HESAP YAPMAZ. İş kuralları (D1–D18) istemcide durur; buraya yalnız
    ekranda görünen hücrelerin METNİ gelir. Sebep 06-uzak.js'teki kararla
    aynı: kuralın iki yerde durması, iki ayrı doğruya yol açar. Burada tek
    iş dizgidir — hangi sütun, hangi satır, hangi hizada.

    Yazı tipi: Windows'ta her zaman bulunan Arial. Türkçe harfler (ı, ğ, ş,
    İ) bu ailede tamdır; QuestPDF sistem yazı tiplerinden okur.  */
public static class RaporPdf
{
    /// <summary>Bir rapor bölümü: başlık + sütun adları + satırlar.</summary>
    public sealed record Bolum(string Ad, string[] Sutunlar, string[][] Satirlar, bool[]? SagaYasli);

    /// <summary>Tek sayfalık rapor üretir ve PDF baytlarını döner.</summary>
    public static byte[] Uret(string baslik, string altBaslik, IReadOnlyList<Bolum> bolumler)
    {
        var belge = Document.Create(kap =>
        {
            kap.Page(sayfa =>
            {
                sayfa.Size(PageSizes.A4.Landscape());
                sayfa.Margin(14, Unit.Millimetre);
                sayfa.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(8).FontColor("#14171c"));

                sayfa.Header().Column(k =>
                {
                    k.Item().Text(baslik).FontSize(14).Bold();
                    if (!string.IsNullOrWhiteSpace(altBaslik))
                        k.Item().PaddingTop(2).Text(altBaslik).FontSize(8.5f).FontColor("#3d434e");
                    k.Item().PaddingTop(6).LineHorizontal(1).LineColor("#14171c");
                });

                sayfa.Content().PaddingTop(10).Column(k =>
                {
                    for (var i = 0; i < bolumler.Count; i++)
                    {
                        var b = bolumler[i];
                        if (i > 0) k.Item().PaddingTop(14);
                        k.Item().PaddingBottom(4).Text(b.Ad).FontSize(10.5f).Bold();
                        k.Item().Element(e => Tablo(e, b));
                    }
                });

                sayfa.Footer().AlignRight().Text(t =>
                {
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        });

        return belge.GeneratePdf();
    }

    private static void Tablo(IContainer kap, Bolum b)
    {
        // Sütun genişliği: ilk sütun (ad) iki pay, sayısal sütunlar bir pay.
        // Sabit px verilmez — A4 genişliği değişse de tablo kâğıda sığar.
        kap.Table(t =>
        {
            t.ColumnsDefinition(s =>
            {
                for (var c = 0; c < b.Sutunlar.Length; c++)
                    s.RelativeColumn(c == 0 ? 2.4f : 1f);
            });

            t.Header(h =>
            {
                for (var c = 0; c < b.Sutunlar.Length; c++)
                {
                    var hucre = h.Cell().Background("#f1f3f7").BorderBottom(1).BorderColor("#c9ced8")
                                 .PaddingVertical(4).PaddingHorizontal(4);
                    var yazi = hucre.Text(b.Sutunlar[c]).FontSize(7).Bold().FontColor("#3d434e");
                    if (SagaMi(b, c)) yazi.AlignRight();
                }
            });

            foreach (var satir in b.Satirlar)
            {
                for (var c = 0; c < b.Sutunlar.Length; c++)
                {
                    var deger = c < satir.Length ? satir[c] : string.Empty;
                    var hucre = t.Cell().BorderBottom(1).BorderColor("#eef0f3")
                                 .PaddingVertical(3).PaddingHorizontal(4);
                    var yazi = hucre.Text(deger).FontSize(8);
                    if (SagaMi(b, c)) yazi.AlignRight();
                }
            }
        });
    }

    // Hiza bilgisi istemciden gelir; gelmediyse "ilk sütun sola, kalanı sağa"
    // varsayılanı uygulanır — programdaki bütün rapor tabloları böyle.
    private static bool SagaMi(Bolum b, int c)
        => b.SagaYasli is { } h && c < h.Length ? h[c] : c > 0;
}
