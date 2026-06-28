import SwiftUI

struct CreateListingView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("userId") private var userId = ""

    // Form state
    @State private var title = ""
    @State private var description = ""
    @State private var selectedCategory: Category?
    @State private var selectedSubcategory: Category?
    @State private var selectedBrand: Brand?
    @State private var size = ""
    @State private var condition = "like_new"
    @State private var price = ""
    @State private var deliveryOptions = "both"

    // Verification
    @State private var verificationCode = ""
    @State private var wantsVerification = true

    // Data
    @State private var brands: [Brand] = []
    @State private var categories: [Category] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isSubmitting = false

    let conditions = [
        ("new_with_tags", "New with tags"),
        ("like_new", "Like new"),
        ("good", "Good"),
        ("fair", "Fair"),
    ]

    let deliveryChoices = [
        ("hand_off", "Hand-off only"),
        ("courier", "Courier only"),
        ("both", "Both"),
    ]

    private var brandRequiresVerification: Bool {
        guard let brand = selectedBrand else { return false }
        return brand.verificationType != "none"
    }

    var body: some View {
        NavigationStack {
            Form {
                // Photos section (placeholder for MVP)
                Section("Photos") {
                    HStack {
                        ForEach(0..<3) { _ in
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.systemGray5))
                                .frame(width: 80, height: 80)
                                .overlay {
                                    Image(systemName: "plus")
                                        .foregroundStyle(.secondary)
                                }
                        }
                    }
                    Text("Photo upload uses S3 — placeholder for MVP")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                // Category
                Section("Category") {
                    Picker("Category", selection: $selectedCategory) {
                        Text("Select...").tag(nil as Category?)
                        ForEach(categories) { cat in
                            Text(cat.name).tag(cat as Category?)
                        }
                    }

                    if let parent = selectedCategory, let children = parent.children, !children.isEmpty {
                        Picker("Subcategory", selection: $selectedSubcategory) {
                            Text("Select...").tag(nil as Category?)
                            ForEach(children) { sub in
                                Text(sub.name).tag(sub as Category?)
                            }
                        }
                    }
                }

                // Brand
                Section("Brand") {
                    Picker("Brand", selection: $selectedBrand) {
                        Text("None / Other").tag(nil as Brand?)
                        ForEach(brands) { brand in
                            Text(brand.name).tag(brand as Brand?)
                        }
                    }
                }

                // Verification step (conditional)
                if brandRequiresVerification {
                    Section {
                        Toggle("I want to verify this item", isOn: $wantsVerification)

                        if wantsVerification {
                            if let instructions = selectedBrand?.verificationInstructions {
                                Text(instructions)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            TextField("Verification code", text: $verificationCode)
                                .autocapitalization(.none)

                            // Photo upload placeholder
                            Button {
                                // MVP: photo upload stub
                            } label: {
                                Label("Upload code/tag photo", systemImage: "camera")
                            }

                            Text("The \"Verified\" badge means the seller provided a code in the expected format plus a photo. It does not certify authenticity. The platform assumes no responsibility for the authenticity of items.")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    } header: {
                        Text("Verification")
                    } footer: {
                        if !wantsVerification {
                            Text("Skipping verification — the item will be listed as \"Unverified\".")
                        }
                    }
                }

                // Details
                Section("Details") {
                    TextField("Title", text: $title)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    TextField("Size (optional)", text: $size)
                    Picker("Condition", selection: $condition) {
                        ForEach(conditions, id: \.0) { c in
                            Text(c.1).tag(c.0)
                        }
                    }
                }

                // Pricing & delivery
                Section("Pricing & Delivery") {
                    HStack {
                        Text("AED")
                        TextField("Price", text: $price)
                            .keyboardType(.decimalPad)
                    }
                    Picker("Delivery", selection: $deliveryOptions) {
                        ForEach(deliveryChoices, id: \.0) { d in
                            Text(d.1).tag(d.0)
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }

                Section {
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Publish Listing").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(title.isEmpty || selectedSubcategory == nil || price.isEmpty || isSubmitting)
                }
            }
            .navigationTitle("Sell an Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await loadData() }
        }
    }

    private func loadData() async {
        isLoading = true
        async let b = APIClient.shared.getBrands()
        async let c = APIClient.shared.getCategories()
        do {
            brands = try await b
            categories = try await c
        } catch {}
        isLoading = false
    }

    private func submit() {
        guard let priceValue = Double(price) else {
            errorMessage = "Enter a valid price"
            return
        }

        isSubmitting = true
        errorMessage = nil

        let req = CreateListingRequest(
            sellerId: userId,
            title: title,
            description: description.isEmpty ? nil : description,
            categoryId: selectedSubcategory?.id ?? selectedCategory?.id ?? "",
            brandId: selectedBrand?.id,
            size: size.isEmpty ? nil : size,
            condition: condition,
            price: priceValue,
            deliveryOptions: deliveryOptions,
            verificationCode: (brandRequiresVerification && wantsVerification && !verificationCode.isEmpty) ? verificationCode : nil,
            verificationPhotoUrl: (brandRequiresVerification && wantsVerification && !verificationCode.isEmpty) ? "https://placeholder.com/verification.jpg" : nil,
            photoUrls: ["https://placeholder.com/photo.jpg"]
        )

        Task {
            do {
                _ = try await APIClient.shared.createListing(req)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}
