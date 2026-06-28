import SwiftUI

struct OrderDetailView: View {
    let orderId: String
    @AppStorage("userId") private var userId = ""
    @State private var order: Order?
    @State private var isLoading = true
    @State private var showDisputeSheet = false
    @State private var showReviewSheet = false
    @State private var showShipSheet = false
    @State private var errorMessage: String?

    private var isBuyer: Bool { order?.buyerId == userId }
    private var isSeller: Bool { order?.sellerId == userId }

    var body: some View {
        ScrollView {
            if isLoading {
                ProgressView().padding(.top, 100)
            } else if let order {
                VStack(spacing: 20) {
                    // Status card
                    VStack(spacing: 10) {
                        Image(systemName: statusIcon)
                            .font(.system(size: 32))
                            .foregroundStyle(statusColor)
                        Text(order.statusLabel)
                            .font(.headline)
                        if order.status == "dispute_window", let deadline = order.disputeDeadlineDate {
                            Text("Dispute window until \(deadline, style: .relative)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(20)
                    .background(statusColor.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Item
                    if let listing = order.listing {
                        HStack(spacing: 14) {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color(.systemGray6))
                                .frame(width: 70, height: 70)
                                .overlay {
                                    if let photo = listing.photos?.first {
                                        AsyncImage(url: URL(string: photo.url)) { image in
                                            image.resizable().scaledToFill()
                                        } placeholder: {
                                            Image(systemName: "photo").foregroundStyle(.quaternary)
                                        }
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                    }
                                }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(listing.title).font(.subheadline.bold())
                                if let brand = listing.brand {
                                    Text(brand.name.uppercased())
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .tracking(0.5)
                                }
                                PriceTag(amount: order.finalPrice, font: .title3)
                            }
                            Spacer()
                        }
                        .padding(16)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    // Parties
                    VStack(spacing: 12) {
                        if let buyer = order.buyer {
                            partyRow(avatar: nil, name: buyer.name, role: "Buyer", city: buyer.city)
                        }
                        if let seller = order.seller {
                            partyRow(avatar: nil, name: seller.name, role: "Seller", city: seller.city)
                        }
                    }
                    .padding(16)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    // Delivery
                    HStack(spacing: 12) {
                        Image(systemName: order.deliveryMethod == "hand_off" ? "person.2.fill" : "shippingbox.fill")
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .frame(width: 36, height: 36)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                        VStack(alignment: .leading, spacing: 2) {
                            Text(order.deliveryMethod == "hand_off" ? "Hand-off" : "Courier")
                                .font(.subheadline.bold())
                            if let tracking = order.trackingNumber {
                                Text("Tracking: \(tracking)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                    }
                    .padding(16)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    // Disputes
                    if let disputes = order.disputes, !disputes.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Disputes").font(.subheadline.bold())
                            ForEach(disputes) { dispute in
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(dispute.reasonLabel)
                                            .font(.caption.bold())
                                        Spacer()
                                        StatusPill(label: dispute.statusLabel, color: .orange)
                                    }
                                    if let desc = dispute.description {
                                        Text(desc).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                                .padding(12)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }
                        .padding(16)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    if let errorMessage {
                        Text(errorMessage).font(.caption).foregroundStyle(.red)
                    }

                    // Actions
                    actionButtons
                }
                .padding(16)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Order")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadOrder() }
        .sheet(isPresented: $showDisputeSheet) {
            DisputeFormView(orderId: orderId) { await loadOrder() }
        }
        .sheet(isPresented: $showReviewSheet) {
            ReviewFormView(orderId: orderId) { await loadOrder() }
        }
        .sheet(isPresented: $showShipSheet) {
            ShipFormView(orderId: orderId) { await loadOrder() }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        VStack(spacing: 10) {
            if isBuyer && order?.status == "pending_payment" {
                Button("Pay Now — AED \(Int(order?.finalPrice ?? 0))") {
                    Task { await pay() }
                }
                .buttonStyle(PrimaryButtonStyle())
            }

            if isSeller && order?.status == "paid_escrow" {
                Button("Mark as Shipped") { showShipSheet = true }
                    .buttonStyle(PrimaryButtonStyle())
            }

            if isBuyer && order?.status == "shipped" {
                Button("Confirm Delivery") {
                    Task { await confirmDelivery() }
                }
                .buttonStyle(PrimaryButtonStyle())
            }

            if isBuyer && order?.status == "dispute_window" {
                Button { showDisputeSheet = true } label: {
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                        Text("Open Dispute")
                    }
                }
                .buttonStyle(SecondaryButtonStyle())
            }

            if order?.status == "completed" {
                Button { showReviewSheet = true } label: {
                    HStack {
                        Image(systemName: "star")
                        Text("Leave a Review")
                    }
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
    }

    private func partyRow(avatar: String?, name: String, role: String, city: String?) -> some View {
        HStack(spacing: 12) {
            AvatarView(url: avatar, size: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(name).font(.subheadline.bold())
                Text(role).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if let city {
                HStack(spacing: 3) {
                    Image(systemName: "mappin")
                    Text(city.replacingOccurrences(of: "_", with: " ").capitalized)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
    }

    private var statusIcon: String {
        switch order?.status {
        case "completed": return "checkmark.circle.fill"
        case "disputed", "refunded": return "exclamationmark.triangle.fill"
        case "shipped": return "shippingbox.fill"
        case "paid_escrow": return "creditcard.fill"
        case "dispute_window": return "clock.badge.checkmark.fill"
        default: return "clock.fill"
        }
    }

    private var statusColor: Color {
        switch order?.status {
        case "completed": return .green
        case "disputed", "refunded", "cancelled": return .red
        default: return .blue
        }
    }

    private func loadOrder() async {
        do { order = try await APIClient.shared.getOrder(id: orderId) } catch {}
        isLoading = false
    }

    private func pay() async {
        do {
            let payment = try await APIClient.shared.initiatePayment(orderId: orderId)
            if let url = URL(string: payment.paymentUrl) {
                await MainActor.run { UIApplication.shared.open(url) }
            }
        } catch { errorMessage = error.localizedDescription }
    }

    private func confirmDelivery() async {
        do { order = try await APIClient.shared.confirmDelivery(orderId: orderId) }
        catch { errorMessage = error.localizedDescription }
    }
}
