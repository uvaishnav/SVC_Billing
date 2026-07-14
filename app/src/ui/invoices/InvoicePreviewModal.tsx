/**
 * InvoicePreviewModal.tsx
 * Full-screen modal that renders a PDF preview of a saved invoice.
 *
 * Uses buildInvoicePayload to fetch all invoice data from Supabase,
 * then renders it with @react-pdf/renderer via PDFViewer (web) or
 * react-native-pdf-lib fallback (native).
 *
 * For Expo / React Native we use react-native-webview with a base64
 * data URI of the generated PDF blob, which avoids native PDF deps.
 */
import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity,
  ActivityIndicator, StyleSheet, Platform, Share, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { pdf } from '@react-pdf/renderer'
import { InvoicePdf } from './pdf/InvoicePdf'
import { buildInvoicePayload } from './pdf/buildInvoicePayload'
import type { InvoicePdfProps } from './pdf/invoicePayloadTypes'

// ── Platform-dependent viewer ────────────────────────────────────────────────
// Web: use an <iframe> with a blob URL.
// Native: embed WebView that loads the base64 data URI.
// This avoids needing a separate native PDF library.

let WebView: any = null
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView
  } catch {
    // WebView not available — preview will show fallback message
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ESPRESSO = '#2C1A0E'
const CREAM    = '#FAF6F0'
const DIVIDER  = '#E8E2D8'
const MUTED    = '#9A8878'

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  invoiceId: number
  onClose: () => void
}

export function InvoicePreviewModal({ invoiceId, onClose }: Props) {
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [pdfUri, setPdfUri]       = useState<string | null>(null)
  const [pdfProps, setPdfProps]   = useState<InvoicePdfProps | null>(null)

  useEffect(() => {
    let cancelled = false

    async function generate() {
      try {
        const payload = await buildInvoicePayload(invoiceId)
        if (cancelled) return
        setPdfProps(payload)

        // Generate the PDF blob
        const blob = await pdf(<InvoicePdf {...payload} />).toBlob()
        if (cancelled) return

        if (Platform.OS === 'web') {
          const url = URL.createObjectURL(blob)
          setPdfUri(url)
        } else {
          // Convert blob to base64 data URI for WebView
          const reader = new FileReader()
          reader.onloadend = () => {
            if (!cancelled && typeof reader.result === 'string') {
              setPdfUri(reader.result)
            }
          }
          reader.readAsDataURL(blob)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to generate PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    generate()
    return () => { cancelled = true }
  }, [invoiceId])

  // Clean up blob URL on unmount (web only)
  useEffect(() => {
    return () => {
      if (pdfUri && Platform.OS === 'web' && pdfUri.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUri)
      }
    }
  }, [pdfUri])

  const handleShare = async () => {
    if (!pdfUri || !pdfProps) return
    try {
      await Share.share({
        title: `Invoice ${pdfProps.invoice_number}`,
        url: pdfUri,
        message: `Invoice ${pdfProps.invoice_number} – ${pdfProps.invoice_date}`,
      })
    } catch (e: any) {
      Alert.alert('Share Error', e?.message ?? 'Could not share invoice')
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={onClose} accessibilityLabel="Close preview">
            <Ionicons name="close" size={22} color={CREAM} />
          </TouchableOpacity>
          <Text style={styles.toolbarTitle}>
            {pdfProps ? pdfProps.invoice_number : 'Invoice Preview'}
          </Text>
          <TouchableOpacity
            style={[styles.toolbarBtn, (!pdfUri || loading) && styles.toolbarBtnDisabled]}
            onPress={handleShare}
            disabled={!pdfUri || loading}
            accessibilityLabel="Share invoice PDF"
          >
            <Ionicons name="share-outline" size={22} color={CREAM} />
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ESPRESSO} />
            <Text style={styles.loadingText}>Generating PDF…</Text>
          </View>
        )}

        {error && (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color="#C0392B" />
            <Text style={styles.errorTitle}>Preview Failed</Text>
            <Text style={styles.errorDetail}>{error}</Text>
          </View>
        )}

        {!loading && !error && pdfUri && (
          Platform.OS === 'web' ? (
            <iframe
              src={pdfUri}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
              title="Invoice PDF"
            />
          ) : WebView ? (
            <WebView
              style={styles.webview}
              source={{ uri: pdfUri }}
              originWhitelist={['*']}
            />
          ) : (
            <View style={styles.centered}>
              <Text style={styles.errorDetail}>PDF preview not available on this device.</Text>
            </View>
          )
        )}
      </View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  toolbar: {
    backgroundColor: ESPRESSO,
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnDisabled: {
    opacity: 0.4,
  },
  toolbarTitle: {
    color: CREAM,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 8,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
  },
  errorDetail: {
    color: '#AAA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  webview: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
})
