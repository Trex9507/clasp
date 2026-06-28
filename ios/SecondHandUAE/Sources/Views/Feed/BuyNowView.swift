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

    let methods = [
        ("hand_off", "Hand-off (meet in person)"),
        ("courier", "Courier delivery"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(listing.title).font(.headline)
                    Text("AED \(Int(listing.price))")
                        .font(.title2.bold())
                }

                Section("Delivery Method") {
                    Picker("Method", selection: $deliveryMethod) {
                        ForEach(methods, id: \.0) { m in
                            Text(m.1).tag(m.0)
                        }
                    }
                    .pickerStyle(.inline)

                    if deliveryMethod == "courier" {
                        TextField("Delivery address", text: $deliveryAddress, axis: .vertical)
                            .lineLimit(2...4)
                    }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red).font(.caption) }
                }

                if let order = createdOrder {
                    Section {
                        VStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.largeTitle)
                                .foregroundStyle(.green)
                            Text("Order Created!")
                                .font(.headline)
                            Text("Order #\(order.id.prefix(8))...")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            if isSubmitting {
                                ProgressView("Initiating payment...")
                            } else if paymentUrl != nil {
                                Text("Payment page opened in browser.")
                                    .font(.subheadline)
                            } else {
                                Text("Go to Orders tab to pay.")
                                    .font(.subheadline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                    }
                } else {
                    Section {
                        Button("Place Order — AED \(Int(listing.price))") { submit() }
                            .disabled(isSubmitting || (deliveryMethod == "courier" && deliveryAddress.isEmpty))
                            .frame(maxWidth: .infinity)
                    }
                }
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
