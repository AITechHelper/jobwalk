import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { reportNotes, type Report } from "./claude";

const BRAND = "#3385ff";

const styles = StyleSheet.create({
  page: {
    fontSize: 11,
    color: "#262626",
    paddingBottom: 48,
  },
  header: {
    backgroundColor: BRAND,
    color: "#ffffff",
    padding: 28,
  },
  businessName: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#e6f0ff",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 8,
  },
  meta: {
    fontSize: 10,
    color: "#e6f0ff",
    marginTop: 10,
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: BRAND,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  paragraph: {
    lineHeight: 1.5,
    color: "#404040",
  },
  note: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  noteFirst: {
    borderTopWidth: 0,
    marginTop: 0,
    paddingTop: 0,
  },
  noteBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#e6f0ff",
    color: BRAND,
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 4,
  },
  noteText: {
    flex: 1,
    lineHeight: 1.5,
    color: "#404040",
  },
  notePhoto: {
    width: 260,
    marginTop: 8,
    borderRadius: 4,
  },
  recBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#f0f6ff",
    borderWidth: 1,
    borderColor: "#cfe1ff",
    borderRadius: 6,
  },
  recItem: {
    flexDirection: "row",
    marginTop: 6,
  },
  recBullet: {
    width: 12,
    color: BRAND,
  },
  recText: {
    flex: 1,
    lineHeight: 1.5,
    color: "#404040",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 28,
    right: 28,
    textAlign: "center",
    fontSize: 8,
    color: "#a3a3a3",
  },
});

export type ReportPdfData = {
  title: string;
  createdAt: Date;
  businessName: string;
  contractorName: string;
  phone: string;
  report: Report;
  photoUrls: Record<string, string>;
};

function ReportDocument({
  title,
  createdAt,
  businessName,
  contractorName,
  phone,
  report,
  photoUrls,
}: ReportPdfData) {
  const notes = reportNotes(report);
  const date = createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.businessName}>{businessName.toUpperCase()}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>
            Walkthrough Report · {date} · {contractorName} · {phone}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.paragraph}>{report.summary}</Text>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Notes</Text>
          {notes.map((note, i) => (
            <View
              key={i}
              style={i === 0 ? [styles.note, styles.noteFirst] : styles.note}
              wrap={false}
            >
              <Text style={styles.noteBadge}>{i + 1}</Text>
              <View style={styles.noteText}>
                <Text>{note.text}</Text>
                {note.photoIds.map((photoId) =>
                  photoUrls[photoId] ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image primitive, not an <img>; PDFs have no alt-text concept
                    <Image
                      key={photoId}
                      src={photoUrls[photoId]}
                      style={styles.notePhoto}
                    />
                  ) : null,
                )}
              </View>
            </View>
          ))}

          {report.recommendations.length > 0 && (
            <View style={styles.recBox} wrap={false}>
              <Text style={styles.sectionLabel}>Recommended next steps</Text>
              {report.recommendations.map((rec, i) => (
                <View key={i} style={styles.recItem}>
                  <Text style={styles.recBullet}>•</Text>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Prepared by {businessName} · {phone}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...data} />);
}
