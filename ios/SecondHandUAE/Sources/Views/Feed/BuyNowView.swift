import SwiftUI

struct BuyNowView: View {
    let listing: Listing

    @Environment(\.dismiss) private var dismiss
    @State private var deliveryMethod = "hand_off"
    @State private var deliveryAddress = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var createdOrder: Order?
    @State private var paymentUrl: URL?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Item summary
                    HStack(spacing: 14) {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(.systemGray6))
                            .frame(width: 64, height: 64)
                            .overlay {
                                if let photo = listing.photos?.first {
                                    AsyncImage(url: URL(string: photo.url)) { image in
                                        image.resizable().scaledToFill()
                                    } placeholder: { Color(.systemGray5) }
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                            }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(listing.title).font(.subheadline.bold()).lineLimit(1)
                            PriceTag(amount: listing.price, font: .title3)
                        }
                        Spacer()
                    }
                    .padding(16)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    if createdOrder == nil {
                        // Delivery method picker
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Delivery Method")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)

                            deliveryOption(value: "hand_off", icon: "person.2", label: "Hand-off", subtitle: "Meet in person")
                            deliveryOption(value: "courier", icon: "shippingbox", label: "Courier", subtitle: "Shipped to your address")

                            if deliveryMethod == "courier" {
                                TextField("Delivery address", text: $deliveryAddress, axis: .vertical)
                                    .lineLimit(2...4)
                                    .padding(14)
                                    .background(Color(.tertiarySystemFill))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }

                        if let errorMessage {
                            Text(errorMessage).font(.caption).foregroundStyle(.red)
                        }

                        Button("Place Order — AED \(Int(listing.price))") { submit() }
                            .buttonStyle(PrimaryButtonStyle())
                            .disabled(isSubmitting || (deliveryMethod == "courier" && deliveryAddress.isEmpty))
                            .padding(.top, 8)
                    } else {
                        // Order success
                        VStack(spacing: 14) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(.green)
                            Text("Order Created!")
                                .font(.title3.bold())

                            if isSubmitting {
                                ProgressView("Initiating payment...")
                                    .font(.subheadline)
                            } else if paymentUrl != nil {
                                Label("Payment page opened in browser", systemImage: "safari")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text("Go to Orders tab to pay")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 32)
                    }
                }
                .padding(24)
            }
            .navigationTitle("Buy Now")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(createdOrder != nil ? "Done" : "Cancel") { dismiss() }
                }
            }
        }
    }

    private func deliveryOption(value: String, icon: String, label: String, subtitle: String) -> some View {
        Button {
            deliveryMethod = value
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.body)
                    .frame(width: 36, height: 36)
                    .background(deliveryMethod == value ? Color.accentColor.opacity(0.1) : Color(.tertiarySystemFill))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.subheadline.bold())
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: deliveryMethod == value ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(deliveryMethod == value ? .accentColor : .secondary)
            }
            .padding(14)
            .background(deliveryMethod == value ? Color.accentColor.opacity(0.05) : Color(.tertiarySystemFill))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(deliveryMethod == value ? Color.accentColor.opacity(0.3) : .clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                let order = try await APIClient.shared.createOrder(
                    CreateOrderRequest(
                        listingId: listing.id,
                        offerId: nil,
                        deliveryMethod: deliveryMethod,
                        deliveryAddress: deliveryMethod == "courier" ? deliveryAddress : nil
                    )
                )
                createdOrder = order
                let payment = try await APIClient.shared.initiatePayment(orderId: order.id)
                if let url = URL(string: payment.paymentUrl) {
                    paymentUrl = url
                    await MainActor.run { UIApplication.shared.open(url) }
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}
